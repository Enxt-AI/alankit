import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Indian Rupees (INR)
 * @param value - The numeric value to format (accepts null/undefined)
 * @returns Formatted currency string (e.g., "₹1,23,456.00") or "₹0.00" for null/undefined
 */
export function formatCurrencyINR(value: number | null | undefined): string {
  // Handle null, undefined, NaN, or non-finite values
  if (value == null || !Number.isFinite(value)) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(0);
  }
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format date string to a readable date format (e.g., "Dec 18, 2025")
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date string to a readable date and time format (e.g., "Dec 18, 2025, 10:30 AM")
 * @param dateString - ISO date string
 * @returns Formatted date and time string
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Resolves a storage URL (e.g. from MinIO) to route through the relative /storage/ proxy,
 * which handles header stripping to avoid MetadataTooLarge errors.
 */
export function getStorageUrl(url: string | null | undefined): string {
  if (!url) return "";
  // API media responses contain absolute URLs, but the API's same-origin
  // resource policy prevents embedding them on the panels domain.
  // Use our storage proxy for first-party files; preserve external image URLs.
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const isFirstParty = parsed.hostname === "unlistedstox.com" ||
        parsed.hostname.endsWith(".unlistedstox.com") ||
        (typeof window !== "undefined" && parsed.hostname === window.location.hostname);
      if (isFirstParty && parsed.pathname.startsWith("/storage/")) {
        url = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // Keep legacy URL handling below for values that cannot be parsed.
    }
  }
  let clean = url.replace(/https?:\/\/[a-zA-Z0-9.-]+:\d+/g, "/storage");
  if (!clean.startsWith("/storage/") && !clean.startsWith("http")) {
    clean = clean.startsWith("/") ? `/storage${clean}` : `/storage/${clean}`;
  }
  // Append cache-busting parameter to bypass any stale 500 error cached in browsers
  if (!clean.includes("?")) {
    clean += "?v=2";
  }
  return clean;
}

