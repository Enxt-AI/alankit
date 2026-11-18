"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useToggleWatchlist } from "@/hooks/useWatchlist";
import { Loader2, Star } from "lucide-react";
import type { UpcomingStock } from "@/types/stock";

interface UpcomingWatchlistButtonProps {
  stock: UpcomingStock;
  className?: string;
}

/**
 * Client-only island: watchlist toggle for an upcoming stock.
 * Needs auth + mutation APIs, so it cannot be server-rendered.
 */
export function UpcomingWatchlistButton({
  stock,
  className,
}: UpcomingWatchlistButtonProps) {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuthStore();
  const userId = user?.id;
  const toggleWatchlistMutation = useToggleWatchlist();
  const [isToggling, setIsToggling] = useState(false);
  const lastToggleAtRef = useRef(0);

  const handleToggleWatchlist = useCallback(() => {
    if (!stock.isActive) return;
    if (!userId) {
      openAuthModal();
      return;
    }
    const now = Date.now();
    if (now - lastToggleAtRef.current < 300) return;
    lastToggleAtRef.current = now;
    setIsToggling(true);
    toggleWatchlistMutation.mutate(
      { stock, stockType: "upcoming" },
      { onSettled: () => setIsToggling(false) },
    );
  }, [stock, userId, openAuthModal, toggleWatchlistMutation, router]);

  if (!stock.isActive) {
    return (
      <button type="button" disabled className={className ?? "font-semibold text-gray-400"}>
        Watchlist
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!isAuthenticated || isToggling}
      onClick={handleToggleWatchlist}
      className={className ?? "font-semibold flex items-center justify-center gap-2"}
    >
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className="h-4 w-4" />
      )}
      Watchlist
    </button>
  );
}
