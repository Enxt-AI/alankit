"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";

export const LAST_ACTIVE_KEY = "unlistedstox_last_active";

function getStoredLastActivity(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const stored = localStorage.getItem(LAST_ACTIVE_KEY);
    const parsed = stored ? parseInt(stored, 10) : 0;
    return parsed > 0 ? parsed : Date.now();
  } catch {
    return Date.now();
  }
}

function setStoredLastActivity(time: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(time));
  } catch {}
}

/**
 * useIdleTimeout — Frontend idle detection hook for session timeout.
 *
 * Monitors cursor/mouse movement, keyboard, scroll, click, and touch
 * to reset the timer. If there is no activity for `timeoutMs`, the
 * user is automatically logged out and redirected to login.
 *
 * Tracks the last activity timestamp in localStorage so that returning
 * to a backgrounded tab, waking a device, or reloading after the idle window
 * immediately triggers a logout instead of granting an unintended extension.
 *
 * @param timeoutMs - Idle timeout in milliseconds (default: 10 minutes = 600,000ms)
 */
export function useIdleTimeout(timeoutMs: number = 10 * 60 * 1000) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      } catch {}
    }

    try {
      await logout();
    } catch {
      // ignore
    }

    // Redirect to login page with clear=true so the proxy clears stale cookies
    if (typeof window !== "undefined") {
      window.location.href = "/login?clear=true&reason=idle";
    }
  }, [logout]);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setStoredLastActivity(now);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const currentTime = Date.now();
      const lastActive = Math.max(lastActivityRef.current, getStoredLastActivity());
      const elapsed = currentTime - lastActive;
      if (elapsed >= timeoutMs) {
        void handleLogout();
      } else {
        // Handle timer skew or partial wakeups
        timerRef.current = setTimeout(() => void handleLogout(), Math.max(0, timeoutMs - elapsed));
      }
    }, timeoutMs);
  }, [handleLogout, timeoutMs]);

  useEffect(() => {
    // Only track idle time for authenticated users
    if (!isAuthenticated) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Check if the user already exceeded the idle window while backgrounded/reloading
    const storedLastActive = getStoredLastActivity();
    if (Date.now() - storedLastActive >= timeoutMs) {
      void handleLogout();
      return;
    }

    // Track mouse, keyboard, scroll, click, and touch events
    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "wheel",
      "mousedown",
      "touchstart",
      "touchmove",
      "scroll",
    ];

    // Start the idle timer
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

    // Verify elapsed idle time when the user returns to tab or window regains focus
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const lastActive = Math.max(lastActivityRef.current, getStoredLastActivity());
        const elapsed = now - lastActive;
        if (elapsed >= timeoutMs) {
          void handleLogout();
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          timerRef.current = setTimeout(() => void handleLogout(), Math.max(0, timeoutMs - elapsed));
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

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
    };
  }, [isAuthenticated, resetTimer, handleLogout, timeoutMs]);
}
