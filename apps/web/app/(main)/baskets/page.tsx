"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBaskets } from "@/hooks/use-baskets";
import { BasketCard, BasketListRow } from "@/components/baskets/basket-card";
import { BasketFilters } from "@/components/baskets/basket-filters";
import { BasketSkeleton } from "@/components/baskets/basket-skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ShoppingBasket,
  XCircle,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function BasketsPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Fetch baskets
  const {
    data: baskets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useBaskets();

  // Extract unique categories and category counts
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    baskets.forEach((basket) => {
      counts[basket.category] = (counts[basket.category] || 0) + 1;
    });
    const unique = Object.keys(counts).sort();
    return { categories: unique, categoryCounts: counts };
  }, [baskets]);

  // Compute spotlight basket
  const spotlightBasket = useMemo(() => {
    if (baskets.length === 0) return null;
    return (
      baskets.find((b) => b.resolvedStatus === "OPEN") || baskets[0] || null
    );
  }, [baskets]);

  // Filter baskets
  const filteredBaskets = useMemo(() => {
    let filtered = baskets;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (basket) =>
          basket.name.toLowerCase().includes(query) ||
          basket.category.toLowerCase().includes(query) ||
          basket.constituents?.some((c) =>
            c.stock?.name?.toLowerCase().includes(query)
          ),
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (basket) => basket.category === selectedCategory,
      );
    }

    return filtered;
  }, [baskets, searchQuery, selectedCategory]);

  // Sort baskets
  const sortedBaskets = useMemo(() => {
    const sorted = [...filteredBaskets];

    switch (sortBy) {
      case "newest":
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case "price-asc":
        return sorted.sort(
          (a, b) => (a.currentPrice || 0) - (b.currentPrice || 0),
        );
      case "price-desc":
        return sorted.sort(
          (a, b) => (b.currentPrice || 0) - (a.currentPrice || 0),
        );
      case "name-asc":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return sorted;
    }
  }, [filteredBaskets, sortBy]);

  const handleViewDetails = (basketId: string) => {
    router.push(`/baskets/${basketId}`);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSortBy("newest");
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC]">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 pt-6 sm:pt-10 pb-20">
        
        {/* ── SECTION 1: CLEAN WHITE & GREEN 600 HERO ── */}
        <div className="relative mb-10 sm:mb-12 overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 sm:p-10 lg:p-12 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-3">
              {/* Tag text without pill container */}
              <p className="font-dm-sans text-xs sm:text-sm font-semibold text-green-600 uppercase tracking-wider mb-2">
                Stock Baskets &bull; Curated by SMC
              </p>

              {/* Main Heading using About Us font (DM Sans, font-semibold) */}
              <h1 className="font-dm-sans text-3xl sm:text-5xl lg:text-[54px] font-semibold text-[#0F172A] leading-[1.14] tracking-[-0.028em] text-balance mb-4">
                Diversified Baskets for{" "}
                <span className="text-green-600 font-semibold">
                  Pre-IPO Growth
                </span>
              </h1>

              {/* Subtitle using About Us font styling */}
              <p className="font-dm-sans text-sm sm:text-base text-slate-600 max-w-lg leading-relaxed font-normal tracking-[-0.01em]">
                Invest in research-curated unlisted portfolios in a single transaction. 
                Diversify risk across multiple private companies and receive verified physical 
                shares credited straight into your Demat account.
              </p>
            </div>

            {/* Right Spotlight Card Column */}
            <div className="lg:col-span-5">
              {spotlightBasket ? (
                <div className="relative rounded-2xl border-2 border-green-600/30 bg-white p-6 sm:p-7 shadow-md transition-all hover:border-green-600">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-dm-sans text-xs font-semibold text-green-700 uppercase tracking-wider">
                      Spotlight Basket
                    </span>
                    <span className="font-dm-sans text-xs font-semibold text-green-600 uppercase tracking-wider">
                      {spotlightBasket.category}
                    </span>
                  </div>

                  <h3 className="font-dm-sans text-xl sm:text-2xl font-semibold text-[#0F172A] tracking-tight line-clamp-1">
                    {spotlightBasket.name}
                  </h3>
                  <p className="font-dm-sans text-gray-500 text-xs sm:text-sm line-clamp-2 mt-1 leading-relaxed">
                    {spotlightBasket.description ||
                      "Balanced unlisted stock portfolio providing high-growth exposure to pre-IPO leaders."}
                  </p>

                  {/* Included Stocks Chips */}
                  {spotlightBasket.constituents && spotlightBasket.constituents.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="font-dm-sans text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        Included Holdings ({spotlightBasket.constituents.length} stocks):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {spotlightBasket.constituents.slice(0, 4).map((c, i) => (
                          <span
                            key={i}
                            className="font-dm-sans text-[11px] font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg truncate max-w-[130px]"
                          >
                            {c.stock?.name || "Constituent"}
                          </span>
                        ))}
                        {spotlightBasket.constituents.length > 4 && (
                          <span className="font-dm-sans text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-1 rounded-lg">
                            +{spotlightBasket.constituents.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Spotlight Price & CTA */}
                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-dm-sans text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        Basket Price
                      </p>
                      <p className="font-dm-sans text-xl sm:text-2xl font-semibold text-[#0F172A]">
                        ₹{spotlightBasket.currentPrice?.toLocaleString("en-IN") || "0"}
                      </p>
                    </div>

                    <Button
                      asChild
                      className="h-10 sm:h-11 px-5 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all"
                    >
                      <Link href={`/baskets/${spotlightBasket.slug || spotlightBasket.id}`}>
                        Explore Basket
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-dm-sans text-lg font-semibold text-gray-900">
                    Why Invest in Stock Baskets?
                  </h3>
                  <p className="font-dm-sans text-xs sm:text-sm text-gray-500 leading-relaxed">
                    Instead of concentrating on a single unlisted stock, baskets bundle the top sector winners, giving you balanced risk-adjusted exposure.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 2: FILTER & CONTROLS TOOLBAR ── */}
        <div className="mb-6 sm:mb-8">
          <BasketFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sortBy={sortBy}
            onSortChange={setSortBy}
            categories={categories}
            totalResults={sortedBaskets.length}
            categoryCounts={categoryCounts}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        {/* ── SECTION 3: BASKET LIST / GRID PRESENTATION ── */}
        <section aria-label="Stock baskets list" className="mb-16">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <BasketSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {error?.message || "Failed to load baskets. Please try again."}
                </span>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : sortedBaskets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                  <ShoppingBasket className="w-9 h-9 text-green-600" strokeWidth={2} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-xs">
                  <XCircle className="w-5 h-5 text-green-600" fill="currentColor" stroke="white" />
                </div>
              </div>
              <h3 className="font-dm-sans text-[20px] font-semibold text-gray-900 mb-2">
                No Baskets Found
              </h3>
              <p className="font-dm-sans text-gray-500 max-w-[340px] mb-6 leading-relaxed text-[14px]">
                {searchQuery || selectedCategory !== "all"
                  ? "No baskets match your current search query or sector filters. Try adjusting your parameters."
                  : "There are currently no active baskets. Please check back soon or browse regular unlisted stocks."}
              </p>
              {(searchQuery || selectedCategory !== "all" || sortBy !== "newest") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="rounded-xl border-gray-200 text-xs font-semibold text-gray-700 hover:text-green-600 hover:border-green-600"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedBaskets.map((basket) => (
                <BasketCard
                  key={basket.id}
                  basket={basket}
                  onViewDetails={() => handleViewDetails(basket.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedBaskets.map((basket) => (
                <BasketListRow
                  key={basket.id}
                  basket={basket}
                  onViewDetails={() => handleViewDetails(basket.id)}
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
