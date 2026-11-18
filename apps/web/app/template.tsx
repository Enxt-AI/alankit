"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Check if we are running inside Capacitor natively
    if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform()) {
      setIsNative(true);
    }
  }, []);

  if (!isNative) {
    // If desktop or regular mobile browser, render without animations for instant load
    return <>{children}</>;
  }

  // Native Android/iOS Page Transition
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full h-full relative"
    >
      {children}
    </motion.div>
  );
}
