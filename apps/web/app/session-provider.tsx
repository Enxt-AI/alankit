"use client";

import { useSessionInit } from "@/hooks/use-session-init";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import { StepUpModal } from "@/components/auth/step-up-modal";

/**
 * Session Provider Component
 * 
 * Client component wrapper that calls the session initialization hook.
 * Allows session restoration to work in Server Component layouts.
 * 
 * Usage: Wrap children in root layout (app/layout.tsx)
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  useSessionInit();
  useIdleTimeout(); // Auto-logout after 10 min of inactivity (mouse, keyboard, scroll, touch)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const kycStatus = useAuthStore((s) => s.user?.kycStatus);
  const kycAttemptState = useAuthStore((s) => s.user?.kycData?.attemptState);
  const kycSubmittedAt = useAuthStore((s) => s.user?.kycData?.submittedAt);
  const refetchUser = useAuthStore((s) => s.refetchUser);
  const inFlightRef = useRef(false);
  const lastRefetchRef = useRef(0);

  // Debounced refetch that prevents excessive calls (minimum 5s between refetches)
  const debouncedRefetch = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefetchRef.current < 5000) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    lastRefetchRef.current = now;
    try {
      await refetchUser();
    } finally {
      inFlightRef.current = false;
    }
  }, [refetchUser]);

  // Poll only attempts with work in progress, not every unverified account.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (kycStatus !== "PENDING") return;
    if (!["CREATING", "PROCESSING"].includes(kycAttemptState) && !kycSubmittedAt) return;

    let cancelled = false;
    let delay = 20000;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (document.visibilityState === "visible") await debouncedRefetch();
      } catch {
        // Keep retries bounded and avoid unhandled rejections during an outage.
      } finally {
        delay = Math.min(delay * 2, 120000);
        if (!cancelled) timer = setTimeout(poll, delay);
      }
    };
    timer = setTimeout(poll, delay);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [isAuthenticated, kycStatus, kycAttemptState, kycSubmittedAt, debouncedRefetch]);

  // Refetch user profile whenever the tab regains focus.
  // This catches any backend-side status change (admin approval, manual DB edit, etc.)
  // without relying on polling intervals.
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        debouncedRefetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isAuthenticated, debouncedRefetch]);

  return (
    <>
      {children}
      <StepUpModal />
    </>
  );
}
