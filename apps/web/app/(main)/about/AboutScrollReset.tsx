"use client";

import { useEffect } from "react";

export default function AboutScrollReset() {
  useEffect(() => {
    // Keep explicit section links intact.
    if (window.location.hash) return;

    const scrollToTop = () =>
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    scrollToTop();
    // Repeat after the navigation layout commits, as on stock details pages.
    const frame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}
