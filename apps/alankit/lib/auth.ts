"use client";

import { useEffect, useState } from "react";

type AuthResponse = {
  success?: boolean;
  needsEmail?: boolean;
  needsName?: boolean;
  smsSent?: boolean;
  message?: string;
  phone?: string;
  email?: string;
  step?: "phone" | "email" | "name";
  cooldownRemainingSeconds?: number;
};

export async function authRequest(path: string, body?: Record<string, string>): Promise<AuthResponse> {
  let fingerprint: string;
  try {
    fingerprint = localStorage.getItem("device-fingerprint") || crypto.randomUUID();
    localStorage.setItem("device-fingerprint", fingerprint);
  } catch {
    fingerprint = "browser-storage-unavailable";
  }
  const authBase = (process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:3002').replace(/\/$/, '');
  const response = await fetch(`${authBase}/api/auth/${path}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
    headers: {
      "x-device-fingerprint": fingerprint,
      ...(body ? { "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (response.status >= 500) {
    throw new Error("The login service is temporarily unavailable. Please try again shortly.");
  }
  if (!response.ok || data?.success === false) {
    const message = Array.isArray(data?.message) ? data.message.join(". ") : data?.message;
    throw new Error(typeof message === "string" ? message : "Unable to contact the login service. Please try again.");
  }
  if (!data) throw new Error("The login service returned an invalid response.");
  return data;
}

const SESSION_CACHE_MS = 60_000;
let sessionCache: { authenticated: boolean; checkedAt: number } | null = null;
let sessionRequest: Promise<boolean> | null = null;

// Explicit refreshes (after login) must confirm the new session, even if a
// background check started before the sign-in completed.
export async function refreshSession(force = true): Promise<boolean> {
  if (sessionRequest) {
    if (!force) return sessionRequest;
    await sessionRequest;
  }
  if (!force && sessionCache && Date.now() - sessionCache.checkedAt < SESSION_CACHE_MS) {
    return sessionCache.authenticated;
  }

  const request = (async () => {
    let authenticated = false;
    try {
      await authRequest("profile");
      authenticated = true;
    } catch {
      // Logged-out visitors also get a cached result to avoid repeated 401s.
    }
    sessionCache = { authenticated, checkedAt: Date.now() };
    window.dispatchEvent(new CustomEvent("alankit-session-change", { detail: authenticated }));
    return authenticated;
  })();
  sessionRequest = request;
  try {
    return await request;
  } finally {
    if (sessionRequest === request) sessionRequest = null;
  }
}

export async function logout(): Promise<void> {
  try {
    await authRequest("signout", {});
  } catch {
    // Clear local session state even if the signout request fails.
  }
  sessionCache = { authenticated: false, checkedAt: Date.now() };
  window.dispatchEvent(new CustomEvent("alankit-session-change", { detail: false }));
}

export function useAuthSession() {
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    let active = true;
    const update = () => { void refreshSession(false).then(value => { if (active) setAuthenticated(value); }); };
    const changed = (event: Event) => setAuthenticated((event as CustomEvent<boolean>).detail === true);
    window.addEventListener("alankit-session-change", changed);
    window.addEventListener("focus", update);
    update();
    return () => {
      active = false;
      window.removeEventListener("alankit-session-change", changed);
      window.removeEventListener("focus", update);
    };
  }, []);
  return authenticated;
}
