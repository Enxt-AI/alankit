"use server";

import { revalidateTag, revalidatePath } from "next/cache";

/**
 * CACHE REVALIDATION UTILITIES
 * 
 * These functions are meant to be called from Server Actions 
 * after mutations (create/update/delete) to ensure the 
 * public-facing ISR pages and server caches are updated.
 */

export async function revalidateStocks() {
  revalidateTag("stocks", { expire: 0 });
  revalidatePath("/stocks");
  revalidatePath("/");
}

export async function revalidateNews() {
  revalidateTag("news", { expire: 0 });
  revalidatePath("/news");
  revalidatePath("/");
}

export async function revalidateContent() {
  revalidateTag("content", { expire: 0 });
}

export async function revalidateStockDetail(idOrName: string) {
  revalidatePath(`/stocks/${idOrName}`);
}

/**
 * Global revalidation (use sparingly)
 */
export async function revalidateAll() {
  revalidatePath("/", "layout");
}
