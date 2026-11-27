"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { withBasePath } from "@/lib/base-path";

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Check if running in PWA (standalone mode) and mobile
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const isMobile = window.innerWidth <= 768;

    // Only show if it's PWA and mobile, otherwise immediately hide
    if (!isStandalone || !isMobile) {
      setShow(false);
      return;
    }

    // Hide splash screen after 3 seconds to let GIF play
    const timer = setTimeout(() => {
      setShow(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Avoid hydration mismatch by not rendering anything until client
  if (!isClient) return null;
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500">
      <div className="relative h-64 w-64 max-w-[80vw]">
        <Image
          src={withBasePath("/unlisted-stocks-logo.gif")}
          alt="Loading..."
          fill
          className="object-contain"
          unoptimized // Ensure gif doesn't get converted by Next.js image optimization
          priority
        />
      </div>
    </div>
  );
}
