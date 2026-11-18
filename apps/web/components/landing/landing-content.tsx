"use client";

import { useAuthStore } from "@/store/auth-store";
import HomeFallback from "./HomeFallback";

/**
 * Landing Content Wrapper
 *
 * Shows a skeleton fallback only while the auth state is still loading.
 */
export function LandingContent({ children }: { children: React.ReactNode }) {
  const { isLoading: showSkeleton } = useAuthStore();

  return (
    <>
      {showSkeleton && (
        <div className="block">
          <HomeFallback />
        </div>
      )}
      <div className={showSkeleton ? "hidden" : "block"}>
        {children}
      </div>
    </>
  );
}
