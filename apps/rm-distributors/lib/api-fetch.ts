import { getAuthHeaders } from "./auth-headers";
import { stripBasePath, withBasePath } from "./base-path";

/**
 * Requests use the same host, so the backend can't infer the panel from the page path.
 * Send it explicitly.
 */
function getPanelContextHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const path = stripBasePath(window.location.pathname);
  if (path.startsWith("/distributor")) return { "x-panel-context": "distributor" };
  if (path.startsWith("/branch")) return { "x-panel-context": "branch" };
  if (path.startsWith("/rm")) return { "x-panel-context": "rm" };
  return {};
}

/**
 * Authenticated fetch wrapper.
 * Requests use the same host so browser cookies are sent with the API calls.
 */
const AUTH_SERVICE_URL = (process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:3002').replace(/\/$/, '');
const STOCKS_SERVICE_URL = (process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL || 'http://localhost:3003').replace(/\/$/, '');
const TICKETING_SERVICE_URL = (process.env.NEXT_PUBLIC_TICKETING_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '');
const PAYMENTS_SERVICE_URL = (process.env.NEXT_PUBLIC_PAYMENTS_SERVICE_URL || 'http://localhost:3004').replace(/\/$/, '');

export function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string' || !input.startsWith('/api/')) return input;

  if (input.startsWith('/api/auth/')) return `${AUTH_SERVICE_URL}${input}`;
  if (input.startsWith('/api/stocks/') || input.startsWith('/api/orders/') || input.startsWith('/api/baskets/') || input.startsWith('/api/content/')) {
    return `${STOCKS_SERVICE_URL}${input}`;
  }
  if (input.startsWith('/api/tickets/') || input.startsWith('/api/labels/')) return `${TICKETING_SERVICE_URL}${input}`;
  if (input.startsWith('/api/payments/')) return `${PAYMENTS_SERVICE_URL}${input}`;

  return input;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  input = resolveApiUrl(input);
  const mergedInit: RequestInit = {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...getPanelContextHeader(),
      ...init?.headers,
    },
    credentials: "include",
  };

  const response = await fetch(input, mergedInit);

  if (response.status === 401 && typeof window !== "undefined") {
    // Determine the current portal base path
    const path = stripBasePath(window.location.pathname);
    let loginUrl = "/login/rm?clear=true";
    if (path.startsWith("/distributor")) loginUrl = "/login/distributor?clear=true";
    else if (path.startsWith("/branch")) loginUrl = "/login/branch?clear=true";
    
    // Redirect to login and clear cookies
    window.location.href = withBasePath(loginUrl);
    
    throw new Error("Session expired (401 Unauthorized)");
  }

  // Trigger cross-tab sync on successful auth events (zero-polling)
  if (response.ok && typeof window !== "undefined" && typeof input === "string" && input.match(/\/(login|logout|verify-otp)$/)) {
    try {
      localStorage.setItem("auth_sync", Date.now().toString());
    } catch {}
  }

  return response;
}
