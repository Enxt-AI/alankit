"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { withBasePath } from "@/lib/base-path";

/**
 * useIdleTimeout — Frontend idle detection hook for admin panels.
 *
 * Monitors mouse movement, keyboard typing, scrolling, clicks, and touch interactions
 * to reset the timer. If there is no user activity for `timeoutMs`, the user is
 * automatically logged out and redirected to the panel's login page.
 *
 * Tracks the last activity timestamp so that returning to a backgrounded tab or
 * waking a device after the idle window immediately triggers a logout instead
 * of granting an unintended extension.
 *
 * Detects which panel is active from the URL pathname and calls the
 * corresponding logout function from the auth store.
 *
 * @param timeoutMs - Idle timeout in milliseconds (default: 10 minutes = 600,000ms)
 */
export function useIdleTimeout(timeoutMs: number = 10 * 60 * 1000) {
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Determine active panel prefix
  const path = pathname || "";
  const prefix = path.startsWith("/admin")
    ? "admin"
    : path.startsWith("/cms")
    ? "cms"
    : path.startsWith("/support")
    ? "support"
    : path.startsWith("/marketing")
    ? "marketing"
    : path.startsWith("/accounting")
    ? "accounting"
    : path.startsWith("/operation")
    ? "operation"
    : null;

  // Granular subscription to active panel authentication state only
  const isAuthenticated = useAuthStore((s) => {
    if (prefix === "admin") return !!s.admin;
    if (prefix === "cms") return !!s.cmsAdmin;
    if (prefix === "support") return !!s.supportAdmin;
    if (prefix === "marketing") return !!s.marketingAdmin;
    if (prefix === "accounting") return !!s.accountingAdmin;
    if (prefix === "operation") return !!s.operationAdmin;
    return false;
  });

  const handleLogout = useCallback(async () => {
    if (!prefix) return;

    const store = useAuthStore.getState();
    try {
      if (prefix === "admin") await store.adminLogout();
      else if (prefix === "cms") await store.cmsLogout();
      else if (prefix === "support") await store.supportLogout();
      else if (prefix === "marketing") await store.marketingLogout();
      else if (prefix === "accounting") await store.accountingLogout();
      else if (prefix === "operation") await store.operationLogout();
    } catch {
      // Best-effort logout
    }

    if (typeof window !== "undefined") {
      window.location.href = withBasePath(`/${prefix}/login?clear=true&reason=idle`);
    }
  }, [prefix]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        handleLogout();
      } else {
        // Handle timer skew or partial wakeups
        timerRef.current = setTimeout(handleLogout, Math.max(0, timeoutMs - elapsed));
      }
    }, timeoutMs);
  }, [handleLogout, timeoutMs]);

  useEffect(() => {
    // Only track idle time for authenticated panel users on protected pages
    if (!prefix || !isAuthenticated || pathname?.endsWith("/login") || pathname === "/") {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Comprehensive activity events matching web application
    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "wheel",
      "mousedown",
      "touchstart",
      "touchmove",
      "scroll",
    ];

    // Verify backend session via lightweight call (interceptors handle 401 redirect)
    const verifySession = async () => {
      try {
        if (prefix === "admin") await import("@/lib/auth-api").then(m => m.verifyAdminSession());
        else if (prefix === "cms") await import("@/lib/auth-api").then(m => m.verifyCMSSession());
        else if (prefix === "support") await import("@/lib/auth-api").then(m => m.verifySupportSession());
        else if (prefix === "marketing") await import("@/lib/auth-api").then(m => m.verifyMarketingSession());
        else if (prefix === "accounting") await import("@/lib/auth-api").then(m => m.verifyAccountingSession());
        else if (prefix === "operation") await import("@/lib/auth-api").then(m => m.verifyOperationSession());
      } catch {
        // Interceptors handle 401s
      }
    };

    // Initialize the idle timer and baseline timestamp
    resetTimer();

    // Throttle activity resets to at most once every 1,000ms to avoid unnecessary churn
    let lastHandled = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastHandled > 1000) {
        lastHandled = now;
        resetTimer();
      }
    };

    for (const event of activityEvents) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Verify elapsed idle time and backend session when the user returns to tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          // Tab was inactive/hidden for >= timeoutMs — log out immediately
          handleLogout();
        } else {
          // Still within active window — reset timer for remaining duration
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          timerRef.current = setTimeout(handleLogout, Math.max(0, timeoutMs - elapsed));
          
          // Cross-check with backend to ensure session wasn't terminated on another device
          verifySession();
        }
      }
    };

    // Listen for cross-tab logins (same browser)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_sync") {
        verifySession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      for (const event of activityEvents) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [prefix, isAuthenticated, pathname, resetTimer, handleLogout, timeoutMs]);
}
