"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth-headers";

/**
 * useIdleTimeout — Frontend idle detection hook for RM/Distributor/Branch panels.
 *
 * Monitors user activity (mouse movement, keyboard typing, scrolling, clicks, touch) and
 * automatically logs out + redirects to login after `timeoutMs` of inactivity.
 *
 * Tracks the last activity timestamp so that returning to a backgrounded tab or
 * waking a device after the idle window immediately triggers a logout instead
 * of granting an unintended extension.
 *
 * @param timeoutMs - Idle timeout in milliseconds (default: 10 minutes = 600,000ms)
 */
export function useIdleTimeout(timeoutMs: number = 10 * 60 * 1000) {
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLogout = useCallback(async () => {
    let userType: string | null = null;
    if (typeof window !== "undefined") {
      userType = localStorage.getItem("userType");
      localStorage.removeItem("userType");
    }

    const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
    let loginPath = "/login/rm";
    let logoutEndpoint = "/api/auth/rm/logout";

    if (userType === "distributor" || currentPath.startsWith("/distributor")) {
      loginPath = "/login/distributor";
      logoutEndpoint = "/api/auth/distributor/logout";
    } else if (userType === "branch" || currentPath.startsWith("/branch")) {
      loginPath = "/login/branch";
      logoutEndpoint = "/api/auth/branch/logout";
    }

    try {
      await fetch(logoutEndpoint, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
    } catch {
      // Best-effort logout
    }

    if (typeof window !== "undefined") {
      window.location.href = `${loginPath}?clear=true&reason=idle`;
    }
  }, [pathname]);

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
        timerRef.current = setTimeout(handleLogout, Math.max(0, timeoutMs - elapsed));
      }
    }, timeoutMs);
  }, [handleLogout, timeoutMs]);

  useEffect(() => {
    const isLoginPage =
      pathname?.startsWith("/login") ||
      pathname === "/" ||
      pathname === "/forgot-password" ||
      pathname === "/change-password";
    const userType = typeof window !== "undefined" ? localStorage.getItem("userType") : null;
    const isProtected =
      pathname?.startsWith("/distributor") ||
      pathname?.startsWith("/branch") ||
      pathname?.startsWith("/rm");

    // Only track idle time for authenticated users on protected pages
    if (isLoginPage || (!userType && !isProtected)) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "wheel",
      "mousedown",
      "touchstart",
      "touchmove",
      "scroll",
    ];

    // Start the idle timer and baseline timestamp
    resetTimer();

    // Throttle activity resets to at most once every 1,000ms
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

    // Verify backend session via lightweight call
    const verifySession = async () => {
      let endpoint = "/api/auth/rm/verify";
      const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
      const userType = typeof window !== "undefined" ? localStorage.getItem("userType") : null;
      if (userType === "distributor" || currentPath.startsWith("/distributor")) {
        endpoint = "/api/auth/distributor/verify";
      } else if (userType === "branch" || currentPath.startsWith("/branch")) {
        endpoint = "/api/auth/branch/verify";
      }

      try {
        await import("@/lib/api-fetch").then(m => m.apiFetch(endpoint));
      } catch {
        // apiFetch handles 401 intercept and redirect automatically
      }
    };

    // Verify elapsed idle time when the user returns to tab or window regains focus
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          handleLogout();
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          timerRef.current = setTimeout(handleLogout, Math.max(0, timeoutMs - elapsed));
          
          verifySession();
        }
      }
    };

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
  }, [pathname, resetTimer, handleLogout, timeoutMs]);
}

