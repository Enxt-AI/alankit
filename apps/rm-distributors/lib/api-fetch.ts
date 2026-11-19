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
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
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
