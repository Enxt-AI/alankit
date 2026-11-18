"use client";

import { useEffect, useState } from 'react';

/** Refresh expiry labels/buttons while Orders stays open. */
export function usePaymentClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return now;
}
