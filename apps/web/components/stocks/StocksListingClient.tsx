"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStocks } from "@/hooks/use-stocks";
import { useStockCategories } from "@/hooks/use-stocks";
import { useUpcomingStocks } from "@/hooks/use-upcoming-stocks";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { useAuthStore } from "@/store/auth-store";
import { StockFilters } from "@/components/stocks/stock-filters";
import { StockList } from "@/components/stocks/stock-list";
import type { Stock, UpcomingStock } from "@/types/stock";
import { getStockSlug } from "@/lib/utils";
import { SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type SortType = "NONE" | "ALPHA" | "MARKET_CAP";
type SortOrder = "ASC" | "DESC";
type DisplayStock = Stock | UpcomingStock;

export default function StocksListingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortType, setSortType] = useState<SortType>("NONE");
  const [sortOrder, setSortOrder] = useState<SortOrder>("ASC");
  const [activeTab, setActiveTab] = useState<"Latest" | "Popular" | "Upcoming">("Latest");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [togglingStockIds, setTogglingStockIds] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const lastToggleAtRef = useRef<Record<string, number>>({});

  // Sync category filter from URL params if present (e.g. /stocks?category=... or ?categoryId=...)
  useEffect(() => {
    const cat =
      searchParams?.get("category") ||
      searchParams?.get("categoryId") ||
      searchParams?.get("sector");
    if (cat) {
      setSelectedCategoryId(cat);
    }
  }, [searchParams]);

  useEffect(() => {
    setMaxPrice(undefined);
  }, [activeTab]);

  const userId = useAuthStore((state) => state.user?.id);

  const handleSearchChange = useCallback((query: string) => { setSearchQuery(query); }, []);

  const { data: stocks, isLoading, isError, error, refetch } = useStocks();
  const { data: categories = [], isLoading: categoriesLoading } = useStockCategories();
  const { data: upcomingStocks, isLoading: isLoadingUpcoming, isError: isErrorUpcoming, error: errorUpcoming, refetch: refetchUpcoming } = useUpcomingStocks({
    enabled: activeTab === "Upcoming",
  });

  const { data: watchlist } = useWatchlist();
  const toggleWatchlistMutation = useToggleWatchlist();

  // Merge and enrich categories from API + stocks to ensure seamless matching and accurate counts
  const effectiveCategories = useMemo(() => {
    const list = [...categories];
    const knownIds = new Set(list.map((c) => c.id.toLowerCase()));
    const knownNames = new Set(list.map((c) => c.name.toLowerCase()));

    // Collect any category objects on stocks not already in the category list
    for (const stock of stocks ?? []) {
      const cat = (stock as any).category;
      if (cat?.id && cat?.name) {
        const idLower = cat.id.toLowerCase();
        const nameLower = cat.name.toLowerCase();
        if (!knownIds.has(idLower) && !knownNames.has(nameLower)) {
          knownIds.add(idLower);
          knownNames.add(nameLower);
          list.push({
            id: cat.id,
            name: cat.name,
            stockCount: 0,
          });
        }
      }
    }

    const baseStocks = activeTab === "Upcoming" ? (upcomingStocks ?? []) : (stocks ?? []);

    return list.map((cat) => {
      const targetId = cat.id;
      const targetName = cat.name.toLowerCase().trim();

      const count = baseStocks.filter((s) => {
        const stockCatId = (s as any).categoryId || (s as any).category?.id;
        if (stockCatId && stockCatId === targetId) return true;

        const stockCatName =
          (s as any).category?.name?.toLowerCase().trim() ||
          (typeof (s as any).category === "string" ? (s as any).category.toLowerCase().trim() : undefined) ||
          (s as any).sector?.toLowerCase().trim();
        if (stockCatName && stockCatName === targetName) return true;

        if (s.tags && Array.isArray(s.tags)) {
          return s.tags.some((t: string) => {
            const clean = t.toLowerCase().trim();
            return clean === targetName || clean.includes(targetName) || targetName.includes(clean);
          });
        }
        return false;
      }).length;

      return {
        ...cat,
        stockCount: count > 0 ? count : (cat.stockCount || 0),
      };
    });
  }, [categories, stocks, upcomingStocks, activeTab]);

  const activeCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return (
      effectiveCategories.find(
        (c) =>
          c.id === selectedCategoryId ||
          c.name.toLowerCase() === selectedCategoryId.toLowerCase()
      ) || null
    );
  }, [effectiveCategories, selectedCategoryId]);

  const watchlistedStockIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of watchlist ?? []) {
      if (entry.stock?.id) ids.add(entry.stock.id);
      if (entry.upcomingStock?.id) ids.add(entry.upcomingStock.id);
    }
    return ids;
  }, [watchlist]);

  const currentTabStocks = useMemo(() => {
    if (activeTab === "Upcoming") return upcomingStocks || [];
    if (activeTab === "Popular") return stocks?.filter(s => s.isPopular) || [];
    return stocks || [];
  }, [activeTab, stocks, upcomingStocks]);

  const maxStockPrice = useMemo(() => {
    const prices = currentTabStocks.map((s) => s.price);
    return prices.length > 0 ? Math.max(...prices) : 500000;
  }, [currentTabStocks]);

  const minStockPrice = useMemo(() => {
    const prices = currentTabStocks.map((s) => s.price);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [currentTabStocks]);

  const filteredStocks = useMemo<DisplayStock[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    const baseRegular = stocks ?? [];
    const baseUpcoming = upcomingStocks ?? [];

    let base: DisplayStock[] = [];
    if (activeTab === "Upcoming") base = baseUpcoming;
    else if (activeTab === "Popular") base = baseRegular.filter((s) => s.isPopular === true);
    else base = baseRegular;

    const currentMaxPrice = maxPrice ?? maxStockPrice;

    let result = base.filter((stock) => {
      const cin = stock.cin || "";
      const name = stock.name.toLowerCase();
      let matchSearch = !query;
      if (query) {
        matchSearch = name.includes(query) || 
                      cin.includes(query) ||
                      (query === "nse" && name.includes("national stock exchange")) ||
                      (query === "csk" && name.includes("chennai super kings"));
      }
      
      const matchPrice = stock.price <= currentMaxPrice;
      
      let matchSector = true;
      if (selectedCategoryId) {
        const matchingCategory = effectiveCategories.find(
          (category) =>
            category.id === selectedCategoryId ||
            category.name.toLowerCase() === selectedCategoryId.toLowerCase()
        );
        const targetId = matchingCategory ? matchingCategory.id : selectedCategoryId;
        const targetName = matchingCategory
          ? matchingCategory.name.toLowerCase().trim()
          : selectedCategoryId.toLowerCase().trim();

        // 1. Direct Category ID match
        const stockCatId = (stock as any).categoryId || (stock as any).category?.id;
        const matchById = Boolean(stockCatId && (stockCatId === targetId || stockCatId === selectedCategoryId));

        // 2. Category Name match
        const stockCatName =
          (stock as any).category?.name?.toLowerCase().trim() ||
          (typeof (stock as any).category === "string" ? (stock as any).category.toLowerCase().trim() : undefined) ||
          (stock as any).sector?.toLowerCase().trim();
        const matchByName = Boolean(
          stockCatName &&
            (stockCatName === targetName ||
              stockCatName === selectedCategoryId.toLowerCase().trim())
        );

        // 3. Tags match (for upcoming stocks or stocks tagged with the sector)
        const matchByTag = Boolean(
          targetName &&
            stock.tags &&
            Array.isArray(stock.tags) &&
            stock.tags.some((t: string) => {
              const clean = t.toLowerCase().trim();
              return clean === targetName || clean.includes(targetName) || targetName.includes(clean);
            })
        );

        matchSector = Boolean(matchById || matchByName || matchByTag);
      }
      
      return matchSearch && matchPrice && matchSector;
    });

    if (sortType === "ALPHA") {
      result = [...result].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return sortOrder === "ASC" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    } else if (sortType === "MARKET_CAP") {
      result = [...result].sort((a, b) => {
        const capA = a.marketCap || 0;
        const capB = b.marketCap || 0;
        return sortOrder === "ASC" ? capA - capB : capB - capA;
      });
    }
    return result;
  }, [activeTab, maxPrice, maxStockPrice, searchQuery, sortOrder, sortType, stocks, upcomingStocks, selectedCategoryId, effectiveCategories]);

  const handleStockClick = (stock: DisplayStock, stockType?: "regular" | "upcoming") => {
    const effectiveType = stockType ?? (activeTab === "Upcoming" ? "upcoming" : "regular");
    if (effectiveType === "upcoming") {
      router.push(`/upcoming-stocks/${stock.id}`);
      return;
    } else {
      router.push(`/stocks/${getStockSlug(stock)}`);
    }
  };

  const handleToggleWatchlist = useCallback((stock: DisplayStock, stockType?: "regular" | "upcoming") => {
    const now = Date.now();
    const last = lastToggleAtRef.current[stock.id] ?? 0;
    if (now - last < 300) return;
    lastToggleAtRef.current[stock.id] = now;

    if (!userId) {
      router.push("/login?returnUrl=" + encodeURIComponent(window.location.pathname));
      return;
    }

    setTogglingStockIds((prev) => {
      const next = new Set(prev);
      next.add(stock.id);
      return next;
    });

    toggleWatchlistMutation.mutate({ stock, stockType }, {
      onSettled: () => {
        setTogglingStockIds((prev) => {
          const next = new Set(prev);
          next.delete(stock.id);
          return next;
        });
      },
    });
  }, [router, toggleWatchlistMutation, userId]);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
        <header className="mb-7 flex w-full flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Discover <span className="text-[#16A34A]">Unlisted Shares</span>
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Access curated pre-IPO and unlisted investment opportunities.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              Showing <span className="font-semibold text-neutral-900">{filteredStocks.length}</span> stocks
            </p>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open filters"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 shadow-sm transition hover:bg-neutral-50 lg:hidden"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" hideClose className="w-[min(88vw,360px)] overflow-y-auto p-4 sm:max-w-[360px]">
                <SheetTitle className="sr-only">Stock filters</SheetTitle>
                <StockFilters
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  totalResults={filteredStocks.length}
                  activeTab={activeTab}
                  onActiveTabChange={setActiveTab}
                  maxPrice={maxPrice ?? maxStockPrice}
                  onMaxPriceChange={setMaxPrice}
                  sliderMin={minStockPrice}
                  sliderMax={maxStockPrice}
                  sliderStep={1000}
                  sortType={sortType}
                  sortOrder={sortOrder}
                  onSortTypeChange={setSortType}
                  onSortOrderChange={setSortOrder}
                  tabs={["Latest", "Upcoming"]}
                  categories={effectiveCategories}
                  categoriesLoading={categoriesLoading}
                  selectedCategoryId={selectedCategoryId}
                  onCategoryChange={setSelectedCategoryId}
                />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
          <div className="hidden lg:block">
            <StockFilters
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              totalResults={filteredStocks.length}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              maxPrice={maxPrice ?? maxStockPrice}
              onMaxPriceChange={setMaxPrice}
              sliderMin={minStockPrice}
              sliderMax={maxStockPrice}
              sliderStep={1000}
              sortType={sortType}
              sortOrder={sortOrder}
              onSortTypeChange={setSortType}
              onSortOrderChange={setSortOrder}
              tabs={["Latest", "Upcoming"]}
              categories={effectiveCategories}
              categoriesLoading={categoriesLoading}
              selectedCategoryId={selectedCategoryId}
              onCategoryChange={setSelectedCategoryId}
            />
          </div>

          <div className="min-w-0 flex-1">
            {/* Active Category Filter Pill */}
            {selectedCategoryId && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500 font-medium">Filtered by:</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 shadow-2xs">
                  <span>Sector: {activeCategory?.name || selectedCategoryId}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId("")}
                    className="hover:bg-emerald-200/60 rounded-full p-0.5 text-emerald-700 transition-colors"
                    title="Remove sector filter"
                    aria-label="Remove sector filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId("")}
                  className="text-xs text-neutral-400 hover:text-neutral-700 underline transition-colors"
                >
                  Clear filter
                </button>
              </div>
            )}

            <StockList
              stocks={filteredStocks}
              isLoading={activeTab === "Upcoming" ? isLoadingUpcoming : isLoading}
              isError={activeTab === "Upcoming" ? isErrorUpcoming : isError}
              error={activeTab === "Upcoming" ? (errorUpcoming as any) : (error as any)}
              onStockClick={handleStockClick}
              onRetry={activeTab === "Upcoming" ? refetchUpcoming : refetch}
              watchlistedStockIds={watchlistedStockIds}
              togglingStockIds={togglingStockIds}
              onToggleWatchlist={handleToggleWatchlist}
              stockType={activeTab === "Upcoming" ? "upcoming" : "regular"}
              onClearSearch={() => setSearchQuery("")}
              onAdjustFilters={() => {
                setSearchQuery("");
                setSortType("NONE");
                setSortOrder("ASC");
                setSelectedCategoryId("");
                setMaxPrice(undefined);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
