'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  X,
  LayoutGrid,
  ArrowUpDown,
  RotateCcw,
  Rows3,
  Grid3X3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BasketFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  categories: string[];
  totalResults: number;
  categoryCounts?: Record<string, number>;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export function BasketFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  categories,
  totalResults,
  categoryCounts = {},
  viewMode = 'grid',
  onViewModeChange,
}: BasketFiltersProps) {
  const [inputValue, setInputValue] = useState(searchQuery);

  // Sync input value when parent resets searchQuery
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // Debounce search with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, onSearchChange]);

  const handleClearSearch = () => {
    setInputValue('');
    onSearchChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClearSearch();
    }
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedCategory !== 'all' || sortBy !== 'newest',
  );

  const handleResetAll = () => {
    setInputValue('');
    onSearchChange('');
    onCategoryChange('all');
    onSortChange('newest');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Unified Filter Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search baskets by name, sector, or unlisted stocks..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 sm:h-11 pl-10 pr-9 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border-gray-200 rounded-xl text-sm font-medium transition-all focus-visible:ring-green-600/20 focus-visible:border-green-600 shadow-none"
              aria-label="Search baskets"
            />
            {inputValue && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-gray-700 rounded-lg"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5">
            {/* Category Filter */}
            <div className="flex-1 sm:flex-initial sm:w-[180px]">
              <Select value={selectedCategory} onValueChange={onCategoryChange}>
                <SelectTrigger
                  className="h-10 sm:h-11 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border-gray-200 rounded-xl text-sm font-medium transition-all"
                  aria-label="Filter by category"
                >
                  <div className="flex items-center gap-2 truncate">
                    <LayoutGrid className="w-4 h-4 text-green-600 shrink-0" />
                    <SelectValue placeholder="All Categories" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-sm">
                    All Sectors
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category} className="rounded-lg text-sm">
                      {category} {categoryCounts[category] ? `(${categoryCounts[category]})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex-1 sm:flex-initial sm:w-[180px]">
              <Select value={sortBy} onValueChange={onSortChange}>
                <SelectTrigger
                  className="h-10 sm:h-11 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border-gray-200 rounded-xl text-sm font-medium transition-all"
                  aria-label="Sort baskets"
                >
                  <div className="flex items-center gap-2 truncate">
                    <ArrowUpDown className="w-4 h-4 text-green-600 shrink-0" />
                    <SelectValue placeholder="Sort by" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                  <SelectItem value="newest" className="rounded-lg text-sm">Newest First</SelectItem>
                  <SelectItem value="price-asc" className="rounded-lg text-sm">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc" className="rounded-lg text-sm">Price: High to Low</SelectItem>
                  <SelectItem value="name-asc" className="rounded-lg text-sm">Name: A to Z</SelectItem>
                  <SelectItem value="name-desc" className="rounded-lg text-sm">Name: Z to A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Toggle (Grid vs List) */}
            {onViewModeChange && (
              <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-green-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('list')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-green-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  aria-label="List view"
                  title="List view"
                >
                  <Rows3 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Reset Button */}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetAll}
                className="h-10 sm:h-11 px-3 text-xs font-semibold text-gray-600 hover:text-gray-900 border-gray-200 rounded-xl gap-1.5 shrink-0"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Category Chips */}
        {categories.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">
              Sectors:
            </span>
            <button
              type="button"
              onClick={() => onCategoryChange('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-green-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              All {totalResults > 0 ? `(${totalResults})` : ''}
            </button>
            {categories.map((cat) => {
              const count = categoryCounts[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  {cat} {count ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Count & Active Filter Indicator */}
      <div className="flex items-center justify-between px-1 text-xs sm:text-sm text-gray-500 font-medium">
        <div>
          Showing <span className="font-bold text-gray-900">{totalResults}</span>{' '}
          {totalResults === 1 ? 'basket' : 'baskets'}
          {selectedCategory !== 'all' && (
            <span>
              {' '}in <span className="font-semibold text-green-700">{selectedCategory}</span>
            </span>
          )}
          {searchQuery && (
            <span>
              {' '}matching &ldquo;<span className="font-semibold text-gray-800">{searchQuery}</span>&rdquo;
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
