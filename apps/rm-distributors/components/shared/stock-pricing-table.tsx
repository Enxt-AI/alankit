"use client";

import { useState } from "react";
import { Search, IndianRupee, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function StockPricingTable({ stocks, isStocksLoading }: { stocks: any[], isStocksLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.name.toLowerCase().includes(search.toLowerCase().trim());
    if (filter === "with-lending") {
      return matchesSearch && stock.lendingPrice != null;
    }
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
  const paginatedStocks = filteredStocks.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-200/80">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">Stock Pricing Catalog</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                Floor Rates
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1 whitespace-nowrap">
              Active selling prices and floor lending rates for client referral codes.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-5 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input 
              type="text" 
              placeholder="Search stocks by name..." 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 w-full bg-slate-50/50 border-slate-200 text-sm focus-visible:ring-emerald-500"
            />
          </div>

          <Select value={filter} onValueChange={(v) => {
            setFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-full sm:w-[220px] bg-slate-50/50 border-slate-200 text-sm">
              <SelectValue placeholder="Filter stocks..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Available Stocks</SelectItem>
              <SelectItem value="with-lending">Stocks with Lending Floor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Stock Name</TableHead>
              <TableHead className="px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right whitespace-nowrap">Selling Price</TableHead>
              <TableHead className="px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right whitespace-nowrap">Lending Price Floor</TableHead>
              <TableHead className="px-6 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider text-center whitespace-nowrap">Minimum Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {isStocksLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-36 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent mx-auto"></div>
                    <span className="text-xs text-slate-400">Loading catalog...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedStocks.length > 0 ? (
              paginatedStocks.map((stock) => (
                <TableRow key={stock.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="px-6 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                    {stock.name}
                  </TableCell>
                  <TableCell className="px-6 py-3.5 font-mono font-medium text-slate-900 text-right whitespace-nowrap">
                    ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="px-6 py-3.5 font-mono font-semibold text-emerald-600 text-right whitespace-nowrap">
                    {stock.lendingPrice ? (
                      `₹${stock.lendingPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-slate-400 font-normal text-xs italic">Not Assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-3.5 text-center whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {stock.minimumPurchaseQuantity || 1} Shares
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                  No stocks found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/40">
          <p className="text-xs text-slate-500 whitespace-nowrap">
            Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredStocks.length)} of {filteredStocks.length} entries
          </p>
          <Pagination className="justify-end w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page === 1 ? "pointer-events-none opacity-50 text-xs" : "cursor-pointer text-xs"}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <PaginationItem key={p} className="hidden sm:inline-block">
                  <PaginationLink 
                    onClick={() => setPage(p)}
                    isActive={page === p}
                    className="cursor-pointer text-xs"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={page === totalPages ? "pointer-events-none opacity-50 text-xs" : "cursor-pointer text-xs"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
