import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import { sanitizeErrorMessage } from "./error-utils";
import { stripBasePath, withBasePath } from "./base-path";

/**
 * API Client Configuration
 *
 * This file provides configured Axios instances for communication with backend microservices.
 *
 * IMPORTANT NOTES:
 * 1. Panels uses HttpOnly cookies for credentials (cookie-only)
 * 2. Do not store tokens in JS-accessible storage for authentication
 * 3. Admin/CMS authentication now calls backend directly instead of Next.js proxy routes
 * 4. Cookies are set on backend domain (localhost:3003 in development) for proper cross-origin cookie handling
 * 5. Do NOT import these clients in Server Components or API routes
 * 6. Response data is NOT unwrapped - use full Axios response for access to headers/status
 * 7. For server-side API calls, create separate server-safe clients
 *
 * Usage:
 * ```typescript
 * import { authApi } from '@/lib/api-client';
 * const response = await authApi.get('/user');
 * const data = response.data; // Access data
 * const headers = response.headers; // Access headers
 * const status = response.status; // Access status code
 * ```
 */

function resolveBrowserSafeBaseURL(envValue: string | undefined): string {
  const fallback = "/api";
  const raw = (envValue || "").trim();
  if (!raw) return fallback;

  // Relative baseURLs are already same-origin.
  if (raw.startsWith("/")) return raw;

  // In the browser, prefer same-origin requests so HttpOnly cookies are
  // set and sent reliably without cross-origin CORS+credentials.
  if (typeof window !== "undefined") {
    return fallback;
  }

  // Non-browser contexts: allow explicit env baseURL.
  return raw;
}

// Auth Service API Client
const authApi = axios.create({
  baseURL: resolveBrowserSafeBaseURL(process.env.NEXT_PUBLIC_AUTH_SERVICE_URL),
  withCredentials: true,
  timeout: 60000,
});

// Stocks Service API Client
const stocksApi = axios.create({
  baseURL: resolveBrowserSafeBaseURL(process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL),
  withCredentials: true,
  timeout: 60000,
});

// Request Interceptor
// Panels runs cookie-only authentication (HttpOnly cookies) via `withCredentials: true`.
// Do not attach Bearer tokens from JS-accessible storage.
const requestInterceptor = (config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const pathSegment = stripBasePath(window.location.pathname).split('/')[1];
    if (pathSegment && ['admin', 'cms', 'marketing', 'accounting', 'operation', 'support'].includes(pathSegment)) {
      config.headers['X-Panel-Context'] = pathSegment;
    }

    // Device fingerprint for session binding (anti-hijacking)
    let fp = localStorage.getItem('device-fingerprint');
    if (!fp) {
      fp = Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      localStorage.setItem('device-fingerprint', fp);
    }
    config.headers['x-device-fingerprint'] = fp;
  }
  return config;
};

const requestErrorInterceptor = (error: AxiosError) => {
  return Promise.reject(error);
};

// Response Interceptor - Pass through full response (no unwrapping)
// This allows consumers to access headers, status codes, etc. when needed
const responseInterceptor = (response: AxiosResponse) => {
  if (typeof window !== 'undefined' && response.config?.url?.match(/\/(login|logout|verify-otp)$/)) {
    try {
      localStorage.setItem('auth_sync', Date.now().toString());
    } catch {}
  }
  return response; // Return full response, not just data
};

const responseErrorInterceptor = (error: AxiosError) => {
  if (error.response) {
    const { status } = error.response;
    
    switch (status) {
      case 401: {
        // CRITICAL: Only redirect to login if this is a genuine session verification failure.
        // Never log out the user if a state mutation (POST/PUT/PATCH/DELETE) encounters a 401/auth failure.
        const requestUrl = error.config?.url || '';
        const isSessionCheck = requestUrl.includes('/verify') || requestUrl.includes('/session') || requestUrl.includes('/profile');
        const isStateMutation = ['post', 'put', 'patch', 'delete'].includes((error.config?.method || '').toLowerCase());
        
        if (isStateMutation && !isSessionCheck) {
          break;
        }

        // Handle session expiry or invalid credentials by cleaning up state and redirecting to login with clear=true
        if (typeof window !== 'undefined') {
          const pathname = stripBasePath(window.location.pathname);
          if (!pathname.endsWith('/login')) {
            const prefix = pathname.split('/')[1] || 'admin';
            if (['admin', 'cms', 'marketing', 'accounting', 'operation', 'support'].includes(prefix)) {
              try {
                const { useAuthStore } = require('@/store/auth-store');
                const store = useAuthStore.getState();
                if (prefix === 'admin') store.setAdmin(null);
                else if (prefix === 'cms') store.setCMSAdmin(null);
                else if (prefix === 'support') store.setSupportAdmin(null);
                else if (prefix === 'marketing') store.setMarketingAdmin(null);
                else if (prefix === 'accounting') store.setAccountingAdmin(null);
                else if (prefix === 'operation') store.setOperationAdmin(null);
              } catch {
                // Best-effort store cleanup
              }

              window.location.href = withBasePath(`/${prefix}/login?clear=true`);
            }
          }
        }
        break;
      }
      case 403:
        // 403 errors are expected for permission-denied scenarios and are handled gracefully by individual API functions
        console.warn("[API Client] 403 Forbidden (handled gracefully):", error.response?.data || 'No details');
        break;
      case 400:
      case 404:
        // Expected 400/404s for cross-entity lookups (admin/user ID mismatches)
        if (error.config?.url?.includes('/auth/admin/') || error.config?.url?.includes('/auth/user/') || error.config?.url?.includes('/auth/marketing/')) {
          // Silent - API functions already log warnings with context
          break;
        }
        // Other 400/404s (genuinely missing/invalid resources)
        console.warn(`[API Client] ${status} Error:`, error.config?.url, error.response?.data);
        break;
      case 500:
        // Server error
        console.error("Server error:", error.response.data);
        break;
      default:
        console.error("API error:", error.response.data);
    }
  } else if (error.request) {
    // Network error - no response received (usually DNS / BACKEND_ORIGIN misconfigured)
    const attemptedUrl = `${error.config?.baseURL || ""}${error.config?.url || ""}`;
    const backendOrigin = typeof window !== "undefined" ? "check apps/panels/.env.local BACKEND_ORIGIN" : "";
    console.error(`Network error - no response received for ${attemptedUrl || error.config?.url} (${error.message}). ${backendOrigin} - Is backend reachable? BACKEND_ORIGIN=http://smc-nginx-staging only works inside Docker; for pnpm dev on host use http://localhost`);
  } else {
    // Request setup error
    console.error("Error:", error.message);
  }

  // Sanitize the Axios error.message string so downstream callers automatically
  // receive clean messages without raw HTTP status codes.
  // IMPORTANT: Do NOT overwrite error.response.data — it contains the real backend
  // validation messages (e.g. NestJS class-validator arrays) that callers need.
  if (error && typeof error === "object") {
    const cleanMsg = sanitizeErrorMessage(error);
    error.message = cleanMsg;
  }
  
  return Promise.reject(error);
};

// Apply interceptors to both API instances
authApi.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
authApi.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

stocksApi.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
stocksApi.interceptors.response.use(responseInterceptor, responseErrorInterceptor);

export { authApi, stocksApi, requestInterceptor, requestErrorInterceptor };