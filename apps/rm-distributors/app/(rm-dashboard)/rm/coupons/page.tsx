"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Ticket, 
  Search, 
  Copy, 
  CheckCircle2, 
  TicketX, 
  Trash2, 
  Percent, 
  IndianRupee,
  Layers,
  Calendar,
  X
} from "lucide-react";
import { useRmCoupons, useDeleteCoupon } from "@/hooks/use-coupons";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

export default function CouponsPage() {
  const { data: rawCoupons = [], isLoading, refetch: refetchCoupons } = useRmCoupons();
  const deleteCouponMutation = useDeleteCoupon();

  const coupons: any[] = rawCoupons;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "REDEEMED">("ALL");
  const [copiedCode, setCopiedCode] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Listen for popup window message to refresh data
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'REFRESH_COUPONS') {
        refetchCoupons();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetchCoupons]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const handleDelete = async (couponId: string) => {
    if (!confirm("Are you sure you want to delete this referral code? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteCouponMutation.mutateAsync(couponId);
    } catch (err: any) {
      alert(err.message || "Failed to delete referral code");
    }
  };

  /** Format discount column for the coupons table */
  const formatDiscount = (coupon: any): string => {
    if (coupon.discountType === "PERCENTAGE" && coupon.discountPercentage) {
      return `${coupon.discountPercentage}%`;
    }
    const amt = coupon.discountAmount || 0;
    return `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: amt % 1 !== 0 ? 2 : 0 })} / Share`;
  };

  // Filter coupons by search query and status filter
  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      const matchesSearch = 
        coupon.code.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (coupon.stock?.name || "").toLowerCase().includes(searchQuery.toLowerCase().trim());

      if (!matchesSearch) return false;

      if (statusFilter === "AVAILABLE") return !coupon.isUsed;
      if (statusFilter === "REDEEMED") return coupon.isUsed;
      return true;
    });
  }, [coupons, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / itemsPerPage));
  const paginatedCoupons = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCoupons.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCoupons, currentPage, itemsPerPage]);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  // Statistics
  const totalCount = coupons.length;
  const availableCount = coupons.filter(c => !c.isUsed).length;
  const redeemedCount = coupons.filter(c => c.isUsed).length;

  const openGeneratePopup = () => {
    const width = 480;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      '/rm/popup/generate-coupon', 
      'GenerateReferralCode', 
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">Referral Codes</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 whitespace-nowrap">
              Discount Codes
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 whitespace-nowrap">
            Generate and manage custom discount codes for your clients.
          </p>
        </div>

        <button
          onClick={openGeneratePopup}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Generate Referral Code</span>
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Codes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Referral Codes</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">
              {totalCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">All generated codes</p>
          </div>
        </div>

        {/* Card 2: Available Codes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Available Codes</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Ticket className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-emerald-600 whitespace-nowrap">
              {availableCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Ready for client checkout</p>
          </div>
        </div>

        {/* Card 3: Redeemed Codes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Redeemed Codes</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <TicketX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-700 whitespace-nowrap">
              {redeemedCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Successfully used in orders</p>
          </div>
        </div>
      </div>

      {/* Search and Status Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:max-w-md flex items-center">
          <Search className="absolute left-3 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search by referral code or stock name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1 bg-transparent focus:outline-none text-sm text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-2 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === "ALL" 
                ? "bg-slate-900 text-white shadow-sm" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            All Codes ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter("AVAILABLE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === "AVAILABLE" 
                ? "bg-emerald-600 text-white shadow-sm" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            Available ({availableCount})
          </button>
          <button
            onClick={() => setStatusFilter("REDEEMED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === "REDEEMED" 
                ? "bg-blue-600 text-white shadow-sm" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            Redeemed ({redeemedCount})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500">Loading referral codes...</p>
          </div>
        </div>
      ) : coupons.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-16 text-center bg-white">
          <div className="h-12 w-12 rounded-full bg-slate-50 shadow-sm flex items-center justify-center mb-4 border border-slate-200">
            <Ticket className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No referral codes created</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-4">
            Generate customized discount codes for your clients to incentivize share purchases.
          </p>
          <button
            onClick={openGeneratePopup}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            Generate Your First Code
          </button>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-14 text-center bg-white">
          <h3 className="text-base font-semibold text-slate-900 mb-1">No matching referral codes</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-4">
            No referral codes matched your filter criteria. Try clearing your search query.
          </p>
          <button
            onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); }}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider uppercase">
                <tr>
                  <th className="px-5 py-3.5 whitespace-nowrap">Referral Code</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Stock Name</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-center">Quantity Range</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-right">Discount per Share</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-center">Status</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-center">Created Date</th>
                  <th className="px-5 py-3.5 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedCoupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Referral Code */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded text-xs border border-slate-200/70">
                          {coupon.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(coupon.code)}
                          className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                          title="Copy referral code"
                        >
                          {copiedCode === coupon.code ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Stock Name */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{coupon.stock?.name || "N/A"}</div>
                    </td>

                    {/* Quantity Range */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {coupon.maxQuantity >= 999999
                          ? `≥ ${coupon.minQuantity} Shares`
                          : coupon.minQuantity === coupon.maxQuantity 
                            ? `${coupon.minQuantity} Shares` 
                            : `${coupon.minQuantity} - ${coupon.maxQuantity} Shares`}
                      </span>
                    </td>

                    {/* Discount per Share */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-semibold text-emerald-600">
                      <div className="flex items-center justify-end gap-1.5">
                        {coupon.discountType === "PERCENTAGE" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/60">
                            <Percent className="h-3 w-3" />
                            {coupon.discountPercentage}% per share
                          </span>
                        ) : (
                          <span>{formatDiscount(coupon)}</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                      {coupon.isUsed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                          <TicketX className="h-3 w-3 text-slate-400" /> Redeemed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-medium">
                          <Ticket className="h-3 w-3 text-emerald-600" /> Available
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-center text-xs text-slate-500">
                      {new Date(coupon.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      {!coupon.isUsed && (
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50"
                          title="Delete Referral Code"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shadcn UI Pagination Controls */}
          <div className="p-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filteredCoupons.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredCoupons.length)}</span> of{" "}
              <span className="font-semibold text-slate-700">{filteredCoupons.length}</span> referral codes
            </p>
            <Pagination className="justify-end w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage((p) => p - 1);
                    }}
                    className={currentPage <= 1 ? "pointer-events-none opacity-40 cursor-not-allowed text-xs h-8" : "cursor-pointer text-xs h-8"}
                  />
                </PaginationItem>

                {getPageNumbers().map((item, idx) => (
                  <PaginationItem key={idx}>
                    {item === "..." ? (
                      <PaginationEllipsis className="h-8 w-8 text-xs" />
                    ) : (
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(Number(item));
                        }}
                        isActive={currentPage === item}
                        className={`cursor-pointer text-xs h-8 w-8 ${currentPage === item ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold" : ""}`}
                      >
                        {item}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage((p) => p + 1);
                    }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-40 cursor-not-allowed text-xs h-8" : "cursor-pointer text-xs h-8"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </div>
  );
}
