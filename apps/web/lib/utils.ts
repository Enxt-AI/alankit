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
 * Generate an SEO-friendly URL slug from a string
 * @param text - The text to slugify (e.g. stock name)
 * @returns SEO-friendly slug
 */
export function generateSlug(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove all non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with a single hyphen
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end
}

/**
 * Gets a valid SEO slug for a stock, falling back to generated slug if the 
 * database slug is a CUID (which can happen due to legacy data)
 */
export function getStockSlug(stock: { id?: string; slug?: string | null; name?: string }): string {
  const isCuid = (str: string) => /^[a-z0-9]{24,36}$/i.test(str);
  
  if (stock.slug && stock.slug !== stock.id && !isCuid(stock.slug)) {
    return stock.slug;
  }
  
  return generateSlug(stock.name || '');
}

/**
 * Resolves a storage URL (e.g. from MinIO) to route through the relative /storage/ proxy,
 * which handles header stripping to avoid MetadataTooLarge errors.
 */
export function getStorageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.replace(/https?:\/\/[a-zA-Z0-9.-]+:\d+/g, "/storage");
}

export function getBgColor(name: string) {
  const colors = [
    "bg-slate-800 text-white",
    "bg-emerald-100 text-emerald-700",
    "bg-pink-100 text-pink-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-blue-100 text-blue-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

