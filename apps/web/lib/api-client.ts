import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { sanitizeErrorMessage } from "./error-utils";

// ─────────────────────────────────────────────────────────────────────────────
// API Client — Production-Ready
//
// Architecture:
//   SSR  → calls microservices directly (no Next.js proxy double-hop)
//   CSR  → uses relative "/api" paths so HttpOnly cookies travel same-origin
//          and Next.js rewrites forward to the correct backend
//
// Auth model: cookie-only (HttpOnly `auth_token` set by backend).
//   This file does NOT store or inject JWT tokens via JS.
//   `withCredentials: true` ensures cookies are sent on every request.
// ─────────────────────────────────────────────────────────────────────────────

const isServer = typeof window === "undefined";

// ── Service URL resolution ──────────────────────────────────────────────────
// Env vars may contain:
//   • An absolute URL  → Docker/K8s (e.g. http://stocks-service:3003/api)
//   • A relative path  → browser-only proxy route (e.g. /api)
//   • Empty            → use defaults
//
// On the server we MUST have an absolute URL; on the browser we MUST have a
// relative path (so cookies are same-origin).

/** Default direct-access ports for local & container environments. */
const SERVICE_DEFAULTS = {
  auth: process.env.AUTH_SERVICE_URL ? `${process.env.AUTH_SERVICE_URL.replace(/\/$/, '')}/api` : "http://auth-service:3002/api",
  stocks: process.env.STOCKS_SERVICE_URL ? `${process.env.STOCKS_SERVICE_URL.replace(/\/$/, '')}/api` : "http://stocks-service:3003/api",
} as const;

function resolveBaseURL(
  envValue: string | undefined,
  service: keyof typeof SERVICE_DEFAULTS,
): string {
  const raw = (envValue || "").trim();

  if (isServer) {
    // Absolute URL already set (Docker / staging) — use as-is.
    if (raw && !raw.startsWith("/")) return raw;

    // BACKEND_ORIGIN is an optional single gateway in front of all services.
    const gateway = (process.env.BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
    if (gateway) return gateway + (raw || "/api");

    // No gateway, no absolute URL → hit each microservice directly by port.
    return SERVICE_DEFAULTS[service];
  }

  // Browser: always same-origin relative path.
  if (raw && raw.startsWith("/")) return raw;
  return "/api";
}

// ── SSR timeout helper ──────────────────────────────────────────────────────
// AbortController-based timeout prevents SSR renders from hanging if a
// backend service is unresponsive. Browser requests use Axios's built-in
// timeout instead (which triggers a proper network error in the browser).

const SSR_TIMEOUT_MS = 5_000;
const BROWSER_TIMEOUT_MS = 30_000;

// ── Client factory ──────────────────────────────────────────────────────────

function createClient(service: keyof typeof SERVICE_DEFAULTS): AxiosInstance {
  const envKey = service === "auth"
    ? process.env.NEXT_PUBLIC_AUTH_SERVICE_URL
    : process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL;

  const instance = axios.create({
    baseURL: resolveBaseURL(envKey, service),
    withCredentials: true,
    timeout: isServer ? SSR_TIMEOUT_MS : BROWSER_TIMEOUT_MS,
  });

  // ── Request interceptor: timing + SSR AbortController ──
  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    (config as any)._startTime = Date.now();

    if (isServer && !config.signal) {
      const controller = new AbortController();
      config.signal = controller.signal;
      setTimeout(() => controller.abort(), SSR_TIMEOUT_MS);
    }

    if (!isServer) {
      let fp = localStorage.getItem("device-fingerprint");
      if (!fp) {
        fp = Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
        localStorage.setItem("device-fingerprint", fp);
      }
      config.headers["x-device-fingerprint"] = fp;
      
      // DPoP Signature Binding
      try {
        const { signDPoPRequest, hashRequestBody } = await import("./dpop");
        const timestamp = Date.now().toString();
        const jti = window.crypto.randomUUID();
        const method = (config.method || "GET").toUpperCase();
        const rawUrl = config.url || "";
        let fullUrl = rawUrl;
        if (config.baseURL && !rawUrl.startsWith("http")) {
          fullUrl = config.baseURL.replace(/\/$/, "") + "/" + rawUrl.replace(/^\//, "");
        }
        let canonicalPath = fullUrl;
        if (canonicalPath.startsWith("http")) {
          try { canonicalPath = new URL(canonicalPath).pathname; } catch(e) {}
        } else {
          canonicalPath = canonicalPath.split('?')[0] || "";
        }
        
        const bodyHash = await hashRequestBody(config.data);
        const signature = await signDPoPRequest(method, canonicalPath, timestamp, jti, bodyHash);
        
        config.headers.set("x-dpop-proof", signature);
        config.headers.set("x-dpop-timestamp", timestamp);
        config.headers.set("x-dpop-jti", jti);
      } catch (err) {
        // Silently ignore if no keypair exists yet (e.g. before login)
        console.error("[DPoP] Failed to sign request:", err);
      }
    }

    return config;
  });

  // ── Response interceptor: latency trace ──
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      logTrace(response.config);
      return response;
    },
    (error: AxiosError) => {
      logTrace(error.config);
      handleResponseError(error);

      // Sanitize the Axios error message and response message so downstream callers
      // automatically receive clean error messages without raw HTTP status codes.
      if (error && typeof error === "object") {
        const status = error.response?.status;
        
        // Skip sanitizing 400 Bad Request to allow class-validator constraints to bubble up unmodified
        if (status !== 400) {
          const cleanMsg = sanitizeErrorMessage(error);
          error.message = cleanMsg;
          if (error.response?.data && typeof error.response.data === "object") {
            (error.response.data as any).message = cleanMsg;
          }
        } else {
          // For 400, just ensure error.message extracts the backend message directly
          const backendMessage = (error.response?.data as any)?.message;
          if (backendMessage) {
            error.message = Array.isArray(backendMessage) ? backendMessage.join(", ") : String(backendMessage);
          }
        }
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

// ── Latency tracing ─────────────────────────────────────────────────────────

function logTrace(config: InternalAxiosRequestConfig | undefined) {
  if (!config) return;
  const start = (config as any)._startTime;
  if (!start) return;

  const duration = Date.now() - start;
  const isSlow = duration > 500;

  if (process.env.NODE_ENV === "development" || isSlow) {
    const method = (config.method || "GET").toUpperCase();
    const label = isServer ? " Server " : "";
    console.log(
      `${label}[API Trace] ${method} ${config.url} - ${duration}ms ${isSlow ? "⚠️ SLOW" : "✅"}`,
    );
  }
}

// ── Error handling ──────────────────────────────────────────────────────────

function summarizePayload(payload: unknown): unknown {
  if (typeof payload !== "string") return payload;
  const t = payload.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html") || t.includes("<title>404")) {
    return "[HTML response — likely missing /api rewrite]";
  }
  return t.length > 500 ? `${t.slice(0, 500)}…(truncated)` : t;
}

const SILENT_401_PATTERNS: RegExp[] = [
  /\/auth\/profile$/,
  /\/auth\/session$/,
  /\/notifications\/unread-count$/,
];

function isSilent401(url: string | undefined): boolean {
  if (!url) return false;
  return SILENT_401_PATTERNS.some((pattern) => pattern.test(url));
}

function handleResponseError(error: AxiosError) {
  if (!error.response) {
    // Network / timeout / abort
    if (error.code === "ERR_CANCELED") {
      console.warn("[API Client] Request aborted (SSR timeout):", error.config?.url);
    } else {
      console.error(
        `[API Client] Network error (${error.config?.method?.toUpperCase() || 'GET'} ${error.config?.baseURL || ''}${error.config?.url || ''}):`,
        error.message,
      );
    }
    return;
  }

  const { status } = error.response;
  const url = error.config?.url;

  switch (status) {
    case 401:
      if (isSilent401(url)) {
        break;
      }
      if (!isServer) {
        const { useAuthStore } = require("@/store/auth-store");
        const { isAuthenticated, logout } = useAuthStore.getState();
        if (isAuthenticated) {
          logout();
          window.location.href = "/login?clear=true";
        }
      }
      break;
    case 400:
    case 404:
      console.warn(`[API Client] ${status}:`, url, summarizePayload(error.response.data));
      break;
    case 403:
      if (error.response?.data && (error.response.data as any).code === "STEP_UP_REQUIRED" && !isServer) {
        window.dispatchEvent(new CustomEvent("STEP_UP_REQUIRED", { detail: error.config }));
        break;
      }
      console.warn("[API Client] 403 Forbidden:", url, error.response.data || "No details");
      break;
    case 500:
      console.error("[API Client] Server error:", summarizePayload(error.response.data));
      break;
    default:
      console.error(`[API Client] ${status}:`, summarizePayload(error.response.data));
  }
}

// ── Exported instances ──────────────────────────────────────────────────────
// Backward-compatible names used by 25+ API modules across the app.

const authApi = createClient("auth");
const stocksApi = createClient("stocks");

export { authApi, stocksApi };
