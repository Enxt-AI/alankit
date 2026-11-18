"use client";

import { useEffect, useRef } from "react";

/**
 * Headless component that triggers the browser's native location permission prompt
 * on first page load for all users (both unlogged-in visitors and logged-in users),
 * without rendering any custom UI pop-ups or modal dialogs.
 */
export function BrowserLocationRequester() {
  const requested = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.isSecureContext || !("geolocation" in navigator)) {
      return;
    }

    const policyDocument = document as Document & {
      permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
      featurePolicy?: { allowsFeature: (feature: string) => boolean };
    };
    const policy = policyDocument.permissionsPolicy ?? policyDocument.featurePolicy;
    if (policy && !policy.allowsFeature("geolocation")) return;

    let cancelled = false;
    const askLocation = async () => {
      // Permissions API also covers user denial in browsers without policy introspection.
      try {
        const permission = await navigator.permissions?.query({ name: "geolocation" });
        if (permission?.state === "denied") return;
      } catch {
        // Some browsers expose Permissions API but do not support this query.
      }
      if (cancelled || requested.current) return;
      requested.current = true;
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            try {
              localStorage.setItem(
                "unlistedstox_user_location",
                JSON.stringify({
                  latitude,
                  longitude,
                  accuracy,
                  timestamp: new Date().toISOString(),
                })
              );
              document.cookie = `user_lat=${latitude}; path=/; max-age=604800; SameSite=Lax`;
              document.cookie = `user_lng=${longitude}; path=/; max-age=604800; SameSite=Lax`;
            } catch {
              // Ignore localStorage restrictions in private browsing mode
            }
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) return;
            console.warn("Browser native location permission:", error?.message || error);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000,
          }
        );
      } catch (err) {
        console.warn("Error invoking geolocation:", err);
      }
    };

    void askLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
