"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getUserProfile } from "@/lib/auth-api";
import type { User } from "@/types/user";

/**
 * Hook for initializing the user session on app load (cookie-only).
 *
 * Design notes:
 * - The web app does NOT store user JWTs in browser storage.
 * - The web app does NOT set `auth_token` from JavaScript.
 * - The backend sets an HttpOnly `auth_token` cookie on successful auth.
 *
 * Because `auth_token` is HttpOnly, the only reliable way to restore client state after
 * refresh is to call `GET /api/auth/profile` (via `getUserProfile()`), which succeeds
 * iff the cookie exists and is valid.
 */
export function useSessionInit() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Client-side only check
    if (typeof window === "undefined") return;

    let cancelled = false;

    // Safety timeout: guarantee isLoading becomes false within 8 s,
    // even if getUserProfile() hangs (slow backend, stale SW, etc.).
    const safetyTimer = window.setTimeout(() => {
      if (cancelled) return;
      const { isLoading: stillLoading } = useAuthStore.getState();
      if (stillLoading) {
        console.warn("[Session Init] Safety timeout — forcing isLoading to false");
        setLoading(false);
      }
    }, 8_000);

    async function hydrateFromCookieSession() {
      // Check if inactivity window expired while user was away / backgrounded prior to reload
      const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
      const storedLastActive = localStorage.getItem("unlistedstox_last_active");
      if (storedLastActive) {
        const lastActiveTime = parseInt(storedLastActive, 10);
        if (lastActiveTime > 0 && Date.now() - lastActiveTime >= IDLE_TIMEOUT_MS) {
          if (process.env.NEXT_PUBLIC_DEBUG_AUTH === "true") {
            console.warn("[Session Init] Inactivity timeout expired prior to page load. Logging out...");
          }
          localStorage.removeItem("unlistedstox_last_active");
          void useAuthStore.getState().logout();
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
          return;
        }
      }

      if (process.env.NEXT_PUBLIC_DEBUG_AUTH === "true") {
        console.log("[Session Init] Hydrating via /auth/profile (cookie-only)...");
      }

      try {
        const profile = await getUserProfile();

        // `getUserProfile()` returns null on 401 (no cookie / expired cookie).
        if (!profile || profile.type !== "USER") {
          if (!cancelled) {
            // If the user logged in while this hydration request was in-flight,
            // don't overwrite the authenticated state with a stale 401/null.
            const isAlreadyAuthed = useAuthStore.getState().isAuthenticated;
            if (!isAlreadyAuthed) {
              setUser(null);
            }
            setLoading(false);
          }
          return;
        }

        // Normalize the profile into the app's `User` shape.
        // (Backend profile objects can evolve; keeping this mapping explicit prevents
        // accidental reliance on extra fields like `type`.)
        const user: User = {
          id: profile.id,
          email: profile.email ?? null,
          fullName: profile.fullName ?? null,
          phone: profile.phone ?? null,
          kycStatus: profile.kycStatus ?? "PENDING",
          // NOTE: referralCode and referredBy removed as part of RM/referral system deprecation.
          currentStep: profile.currentStep ?? 0,
          kycData: profile.kycData ?? null,
          kycDocuments: profile.kycDocuments ?? null,
          dematStatus: profile.dematStatus ?? "PENDING",
          dematData: profile.dematData ?? null,
          dematDocuments: profile.dematDocuments ?? null,
          bankStatus: profile.bankStatus ?? "PENDING",
          bankData: profile.bankData ?? null,
          createdAt: profile.createdAt ?? new Date().toISOString(),
          updatedAt: profile.updatedAt ?? new Date().toISOString(),
        };

        if (!cancelled) {
          try {
            localStorage.setItem("unlistedstox_last_active", String(Date.now()));
          } catch {}
          setUser(user);
          setLoading(false);
        }
      } catch (error) {
        // For non-401 failures (network / 5xx), we treat the session as unavailable
        // for now. We *don't* call logout endpoint here because that would clear a
        // potentially valid cookie due to a transient failure.
        if (process.env.NEXT_PUBLIC_DEBUG_AUTH === "true") {
          console.error("[Session Init] Failed to hydrate session:", error);
        }

        if (!cancelled) {
          const isAlreadyAuthed = useAuthStore.getState().isAuthenticated;
          if (!isAlreadyAuthed) {
            setUser(null);
          }
          setLoading(false);
        }
      }
    }

    hydrateFromCookieSession();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
  }, [setLoading, setUser]);
}
