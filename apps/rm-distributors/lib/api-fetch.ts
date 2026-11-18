import { getAuthHeaders } from "./auth-headers";

/**
 * Cross-origin requests only send the origin as Referer (strict-origin-when-cross-origin),
 * so the backend can't infer the panel from the page path. Send it explicitly.
 */
function getPanelContextHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const path = window.location.pathname;
  if (path.startsWith("/distributor")) return { "x-panel-context": "distributor" };
  if (path.startsWith("/branch")) return { "x-panel-context": "branch" };
  if (path.startsWith("/rm")) return { "x-panel-context": "rm" };
  return {};
}

/**
 * Authenticated fetch wrapper.
 * All requests go through the same-origin Next.js rewrite proxy
 * (distributors.unlistedstox.com → api.unlistedstox.com) so cookies are always sent.
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
    const path = window.location.pathname;
    let loginUrl = "/login/rm?clear=true";
    if (path.startsWith("/distributor")) loginUrl = "/login/distributor?clear=true";
    else if (path.startsWith("/branch")) loginUrl = "/login/branch?clear=true";
    
    // Redirect to login and clear cookies
    window.location.href = loginUrl;
    
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
