import { NextRequest, NextResponse } from "next/server";

function getStocksServiceUrl() {
  const raw = (process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL || "").trim();
  if (raw && !raw.startsWith("/")) {
    return raw;
  }
  const gateway = (process.env.BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
  if (gateway) {
    return `${gateway}/api`;
  }
  return "http://127.0.0.1:3003/api";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  const { cin } = await params;
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");
  const attachmentName = searchParams.get("attachmentName");

  if (!cin || !docId || !attachmentName) {
    return NextResponse.json(
      { error: "cin, docId, and attachmentName are required" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getStocksServiceUrl();
    const url = `${baseUrl}/stocks/company/${encodeURIComponent(cin)}/documents/attachment?docId=${encodeURIComponent(docId)}&attachmentName=${encodeURIComponent(attachmentName)}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Stocks service returned ${response.status}`);
    }

    const dataBuffer = await response.arrayBuffer();

    return new NextResponse(dataBuffer, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition": response.headers.get("Content-Disposition") || `attachment; filename="${attachmentName}"`,
      },
    });
  } catch (error: any) {
    console.error("Document attachment download failed:", error);

    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}
