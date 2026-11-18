import { NextRequest, NextResponse } from "next/server";

// Cache working endpoint in-memory across requests for instant responses
let cachedWorkingBaseUrl: string | null = null;

function getCandidateBaseUrls(): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (url?: string | null) => {
    if (!url) return;
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  // 1. Explicit environment variables
  add(process.env.MINIO_ENDPOINT);
  add(process.env.MINIO_PUBLIC_URL);

  // 2. Production / Staging candidates
  if (process.env.NODE_ENV === "production") {
    // Direct MinIO staging host IP
    add("http://10.0.2.100:9000");

    // NGINX backend proxy (accessible on Docker staging network)
    const backendOrigin = process.env.BACKEND_ORIGIN || "http://smc-nginx-staging:90";
    add(`${backendOrigin.replace(/\/+$/, "")}/storage`);
    add("http://smc-nginx-staging:90/storage");
    add("http://nginx:90/storage");

    // Docker internal container hostnames
    add("http://minio:9000");
    add("http://smc-minio:9000");
    add("http://host-gateway:9000");

    // Storage service fallback (port 3005)
    add("http://storage-service:3005/storage");
    add("http://127.0.0.1:3005/storage");

    // Container localhost fallback
    add("http://127.0.0.1:9000");
    add("http://localhost:9000");
  } else {
    // 3. Local Development candidates
    add("http://127.0.0.1:9000");
    add("http://localhost:9000");
    add("http://10.0.2.100:9000");
    add("http://127.0.0.1:3005/storage");
    add("http://localhost:3005/storage");
    const backendOrigin = process.env.BACKEND_ORIGIN;
    if (backendOrigin) {
      add(`${backendOrigin.replace(/\/+$/, "")}/storage`);
    }
  }

  // If a previously verified working base exists, prioritize it first
  if (cachedWorkingBaseUrl && seen.has(cachedWorkingBaseUrl)) {
    return [
      cachedWorkingBaseUrl,
      ...candidates.filter((c) => c !== cachedWorkingBaseUrl),
    ];
  }

  return candidates;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const pathParts = resolvedParams?.path;

  if (!pathParts || pathParts.length === 0) {
    return new NextResponse("Invalid file path", { status: 400 });
  }

  const filePath = pathParts.join("/");
  const candidateBases = getCandidateBaseUrls();

  // Forward safe standard headers (NO cookies or authorization to prevent MetadataTooLarge in MinIO)
  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const acceptEncoding = request.headers.get("accept-encoding");
  if (acceptEncoding) headers.set("accept-encoding", acceptEncoding);

  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);

  const ifModifiedSince = request.headers.get("if-modified-since");
  if (ifModifiedSince) headers.set("if-modified-since", ifModifiedSince);

  let lastError: any = null;
  let lastResponse: Response | null = null;

  for (const base of candidateBases) {
    const targetUrl = `${base}/${filePath}`;

    const controller = new AbortController();
    // 3.5s connection/first-byte timeout to quickly skip dead candidates
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      let response: Response;
      try {
        response = await fetch(targetUrl, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
      } finally {
        // Clear abort timer as soon as response headers arrive so body streaming isn't interrupted
        clearTimeout(timeoutId);
      }

      // 1. Success (200 OK, 206 Partial Content)
      if (response.ok) {
        cachedWorkingBaseUrl = base;

        const responseHeaders = new Headers();
        const contentType = response.headers.get("content-type");
        if (contentType) responseHeaders.set("Content-Type", contentType);

        const contentLength = response.headers.get("content-length");
        if (contentLength) responseHeaders.set("Content-Length", contentLength);

        const contentDisposition = response.headers.get("content-disposition");
        if (contentDisposition) responseHeaders.set("Content-Disposition", contentDisposition);

        const acceptRanges = response.headers.get("accept-ranges");
        if (acceptRanges) responseHeaders.set("Accept-Ranges", acceptRanges);

        const etag = response.headers.get("etag");
        if (etag) responseHeaders.set("ETag", etag);

        const lastModified = response.headers.get("last-modified");
        if (lastModified) responseHeaders.set("Last-Modified", lastModified);

        responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");

        return new NextResponse(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }

      // 2. 304 Not Modified
      if (response.status === 304) {
        cachedWorkingBaseUrl = base;
        const responseHeaders = new Headers();
        const etag = response.headers.get("etag");
        if (etag) responseHeaders.set("ETag", etag);
        responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");

        return new NextResponse(null, {
          status: 304,
          headers: responseHeaders,
        });
      }

      // 3. If MinIO explicitly returned 404 with XML error (meaning MinIO is healthy, but the file doesn't exist)
      const contentType = response.headers.get("content-type") || "";
      if (response.status === 404 && contentType.includes("xml")) {
        cachedWorkingBaseUrl = base;
        return new NextResponse(response.body, {
          status: 404,
          headers: {
            "Content-Type": contentType,
          },
        });
      }

      // If status is 502/503/504 or non-XML 404 from an intermediary proxy, try next candidate
      lastResponse = response;
    } catch (err: any) {
      lastError = err;
      if (cachedWorkingBaseUrl === base) {
        cachedWorkingBaseUrl = null;
      }
      console.warn(`[Web StorageProxy] Failed candidate ${targetUrl}: ${err?.message || err}`);
    }
  }

  // If we have an upstream response (e.g. 404 Not Found), return it
  if (lastResponse) {
    return new NextResponse(lastResponse.body, {
      status: lastResponse.status,
      headers: {
        "Content-Type": lastResponse.headers.get("Content-Type") || "text/plain;charset=UTF-8",
      },
    });
  }

  // All endpoints failed
  console.error(`[Web StorageProxy] All storage endpoints failed for ${filePath}:`, lastError);
  return new NextResponse(`Proxy Error: ${lastError?.message || "Storage backend unreachable"}`, {
    status: 502,
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
  });
}
