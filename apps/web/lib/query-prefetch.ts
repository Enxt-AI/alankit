import { QueryClient, dehydrate } from "@tanstack/react-query";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getAllStocks, getStockById } from "./stocks-api";
import { getAllNews, getAllArticles, getNewsCategories } from "./content-api";
import { generateSlug, getStockSlug } from "./utils";

/**
 * SELECTIVE SERVER CACHING
 * 
 * We cache heavy/global queries on the server to avoid redundant 
 * backend calls during ISR/SSR across multiple users.
 */
const getCachedStocks = unstable_cache(
  async () => getAllStocks(),
  ["all-stocks-cache"],
  { revalidate: 60, tags: ["stocks"] }
);

const getCachedNews = unstable_cache(
  async (filters?: any) => getAllNews(filters),
  ["all-news-cache"],
  { revalidate: 300, tags: ["news"] }
);

const getCachedCategories = unstable_cache(
  async () => getNewsCategories(),
  ["news-categories-cache"],
  { revalidate: 3600, tags: ["content"] }
);

// Use React cache to prevent creating multiple QueryClients in a single request
export const getQueryClient = cache(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
}));

/**
 * Prefetches global stocks and news for hydration on the Home page
 * PARALLEL: Uses Promise.all to fetch all data simultaneously
 */
export async function prefetchHomeData() {
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["stocks"],
      queryFn: () => getCachedStocks(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["news"],
      queryFn: () => getCachedNews(),
    }),
  ]);

  return dehydrate(queryClient);
}

/**
 * Prefetches all data required for the News listing page
 * PARALLEL: Maximizes concurrency for content data
 */
export async function prefetchNewsData() {
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["news", {}],
      queryFn: () => getCachedNews(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["news-categories"],
      queryFn: () => getCachedCategories(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["articles"],
      queryFn: () => getAllArticles(),
    }),
  ]);

  return dehydrate(queryClient);
}

/**
 * Prefetches specific stock details for hydration
 * FOCUS: Critical data only (Stock Info) to avoid over-prefetching.
 * Related news/articles will load on the client as the user scrolls.
 * 
 * The `id` param can be a stock name (URL-encoded) or a CUID.
 * We first load all stocks to resolve the name → real ID.
 */
export async function prefetchStockData(id: string) {
  const queryClient = getQueryClient();
  const decodedId = decodeURIComponent(id);

  // 1. Prefetch all stocks (needed by the client anyway for name→ID resolution)
  let allStocks: any[] = [];
  try {
    await queryClient.prefetchQuery({
      queryKey: ["stocks"],
      queryFn: () => getCachedStocks(),
    });
    allStocks = queryClient.getQueryData(["stocks"]) || [];
  } catch { /* fallback: skip prefetch */ }

  // 2. Resolve the actual stock ID (param can be name, slug, or CUID)
  const matched = allStocks.find(
    (s: any) => getStockSlug(s) === decodedId || s.name === decodedId || s.id === decodedId,
  );
  const actualId = matched?.id || decodedId;

  // 3. Prefetch the specific stock detail
  await queryClient.prefetchQuery({
    queryKey: ["stock", actualId],
    queryFn: () => getStockById(actualId),
  });

  return dehydrate(queryClient);
}
