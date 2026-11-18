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
//   SSR  → calls microservices directly
//   CSR (Web)  → uses relative "/api" paths so HttpOnly cookies travel same-origin
//   Native (Mobile) → uses absolute URLs and Bearer tokens
// ─────────────────────────────────────────────────────────────────────────────

const isServer = typeof window === "undefined" && typeof navigator !== "undefined" && navigator.product !== "ReactNative";
const isNative = typeof navigator !== "undefined" && navigator.product === "ReactNative";

let mobileAuthToken: string | null = null;
export const setMobileAuthToken = (token: string | null) => {
  mobileAuthToken = token;
};

// Global logout handler to prevent circular dependency with @repo/store
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

// ── Service URL resolution ──────────────────────────────────────────────────
// Env vars may contain:
//   • An absolute URL  → Docker/K8s (e.g. http://stocks-service:3003/api)
//   • A relative path  → browser-only proxy route (e.g. /api)
//   • Empty            → use defaults
//
// On the server we MUST have an absolute URL; on the browser we MUST have a
// relative path (so cookies are same-origin).

/** Default direct-access ports for local development. */
const SERVICE_DEFAULTS = {
  auth:   "http://127.0.0.1:3002/api",
  stocks: "http://127.0.0.1:3003/api",
} as const;

function resolveBaseURL(
  envValue: string | undefined,
  service: keyof typeof SERVICE_DEFAULTS,
): string {
  const raw = (envValue || "").trim();

  if (isServer) {
    // Absolute URL already set (Docker / staging) — use as-is.
    if (raw && !raw.startsWith("/")) return raw;

    // BACKEND_ORIGIN is a single nginx-style gateway in front of all services.
    const gateway = (process.env.BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
    if (gateway) return gateway + (raw || "/api");

    // No gateway, no absolute URL → hit each microservice directly by port.
    return SERVICE_DEFAULTS[service];
  }

  // Browser/Native: Web uses same-origin relative path, Native uses absolute URLs.
  if (!isNative && raw && raw.startsWith("/")) return raw;
  if (isNative && raw) return raw; // e.g. https://api.staging.com
  return isNative ? SERVICE_DEFAULTS[service] : "/api";
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
    withCredentials: !isNative, // Only use cookies on web
    timeout: isServer ? SSR_TIMEOUT_MS : BROWSER_TIMEOUT_MS,
  });

  // ── Request interceptor: timing + SSR AbortController ──
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    (config as any)._startTime = Date.now();

    if (isServer && !config.signal) {
      const controller = new AbortController();
      config.signal = controller.signal;
      setTimeout(() => controller.abort(), SSR_TIMEOUT_MS);
    }

    if (!isServer) {
      // In native, we inject the bearer token if it exists
      if (isNative && mobileAuthToken) {
        config.headers.Authorization = `Bearer ${mobileAuthToken}`;
      }

      let fp: string | null = null;
      if (!isNative) {
        fp = localStorage.getItem("device-fingerprint");
        if (!fp) {
          fp = Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
          localStorage.setItem("device-fingerprint", fp);
        }
      } else {
        // Native fingerprint generation could be added here
        fp = "mobile-device-fingerprint";
      }
      config.headers["x-device-fingerprint"] = fp;
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
        const cleanMsg = sanitizeErrorMessage(error);
        error.message = cleanMsg;
        if (error.response?.data) {
          if (typeof error.response.data === "object") {
            (error.response.data as any).message = cleanMsg;
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
      console.error("[API Client] Network error:", error.message);
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
        if (onUnauthorized) {
          onUnauthorized();
        } else if (typeof window !== "undefined" && window.location) {
          window.location.href = "/login?clear=true";
        }
      }
      break;
    case 400:
    case 404:
      if (url?.includes("/auth/profile") && !isServer) {
        if (onUnauthorized) {
          onUnauthorized();
        } else if (typeof window !== "undefined" && window.location) {
          window.location.href = "/login?clear=true";
        }
        break;
      }
      console.warn(`[API Client] ${status}:`, url, summarizePayload(error.response.data));
      break;
    case 403:
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