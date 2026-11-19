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
  const response = await fetch(`/api/auth/${path}`, {
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

export async function refreshSession(): Promise<boolean> {
  try {
    await authRequest("profile");
    window.dispatchEvent(new CustomEvent("alankit-session-change", { detail: true }));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent("alankit-session-change", { detail: false }));
    return false;
  }
}

export function useAuthSession() {
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    let active = true;
    const update = () => { void refreshSession().then(value => { if (active) setAuthenticated(value); }); };
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
