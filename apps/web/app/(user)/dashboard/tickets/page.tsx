"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket as TicketIcon,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useUserTickets } from "@/hooks/use-tickets";
import { Ticket } from "@/types/ticket";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PAGE_SIZE = 10;

function renderStatusBadge(status: string) {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "in-progress":
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          In Progress
        </span>
      );
    case "open":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          Open
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Resolved
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70">
          Closed
        </span>
      );
    case "escalated":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/70">
          Escalated
        </span>
      );
    case "blocked":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
          Blocked
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          {status}
        </span>
      );
  }
}

function renderPriorityBadge(priority: string) {
  const p = (priority || "").toLowerCase().trim();
  if (p === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70">
        <span className="w-1 h-1 rounded-full bg-rose-500" />
        Urgent
      </span>
    );
  }
  if (p === "high") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200/70">
        High
      </span>
    );
  }
  return null;
}

export default function TicketsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useUserTickets(user?.id || "", {
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const tickets = (data as Ticket[] | undefined) || [];
  const hasNextPage = tickets.length >= PAGE_SIZE;

  // Filter tickets by tab and search
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Tab status filter
      if (statusFilter === "active") {
        const s = (ticket.status || "").toLowerCase();
        if (s !== "open" && s !== "in-progress" && s !== "in_progress" && s !== "escalated") {
          return false;
        }
      } else if (statusFilter === "resolved") {
        const s = (ticket.status || "").toLowerCase();
        if (s !== "resolved" && s !== "closed") {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = (ticket.title || "").toLowerCase().includes(q);
        const matchesDesc = (ticket.description || "").toLowerCase().includes(q);
        const matchesNum = (ticket.ticketNumber || ticket.id || "").toLowerCase().includes(q);
        const matchesCat = (ticket.category || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesNum && !matchesCat) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  // Status counts
  const activeCount = useMemo(() => {
    return tickets.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s === "open" || s === "in-progress" || s === "in_progress" || s === "escalated";
    }).length;
  }, [tickets]);

  const resolvedCount = useMemo(() => {
    return tickets.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s === "resolved" || s === "closed";
    }).length;
  }, [tickets]);

  if (!authLoading && !isAuthenticated) {
    router.replace("/login?returnUrl=/dashboard/tickets");
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-2xs">
              <TicketIcon className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Support Tickets</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track status, view updates, and converse with our support team
          </p>
        </div>

        <Button
          asChild
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 text-xs font-semibold shadow-xs gap-1.5 shrink-0 self-start sm:self-auto transition-all"
        >
          <Link href="/supports">
            <Plus className="w-4 h-4" />
            Create New Ticket
          </Link>
        </Button>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="inline-flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 self-start">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Tickets
            {tickets.length > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "all" ? "bg-slate-100 text-slate-800" : "text-slate-400"
              }`}>
                {tickets.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              statusFilter === "active"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Active
            {activeCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100/80 text-amber-800 font-semibold">
                {activeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              statusFilter === "resolved"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Resolved
            {resolvedCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100/80 text-emerald-800 font-semibold">
                {resolvedCount}
              </span>
            )}
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search by ID or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs rounded-xl border-slate-200/90 bg-white placeholder:text-slate-400 focus-visible:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT CARD ── */}
      {isLoading || authLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-slate-100 bg-white shadow-2xs space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <Alert className="rounded-2xl border-rose-200 bg-rose-50/50 text-rose-900">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>Unable to load support tickets. Please try again.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-xl text-xs border-rose-200 hover:bg-rose-100/50"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100/80 text-slate-400 flex items-center justify-center mx-auto mb-3.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {searchQuery ? "No tickets found" : "No support tickets"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
            {searchQuery
              ? "We couldn't find any tickets matching your search. Try changing the keywords or clearing filters."
              : statusFilter !== "all"
              ? `You do not have any tickets currently marked as "${statusFilter}".`
              : "When you raise a support request regarding KYC, orders, or delivery, your tickets will appear here."}
          </p>
          {searchQuery ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSearchQuery("")}
              className="rounded-xl text-xs h-9 px-4"
            >
              Clear Search
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-5 text-xs font-semibold shadow-2xs"
            >
              <Link href="/supports">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Raise a Support Ticket
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
          {/* Ticket Rows */}
          <div className="divide-y divide-slate-100">
            {filteredTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/dashboard/tickets/${ticket.ticketNumber || ticket.id}`}
                aria-label={`View details for ticket: ${ticket.title}`}
                className="p-4 sm:p-5 hover:bg-slate-50/75 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6"
              >
                <div className="flex-1 min-w-0">
                  {/* Badges line */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/60">
                      {ticket.ticketNumber || `#${ticket.id.slice(0, 8)}`}
                    </span>
                    {renderStatusBadge(ticket.status)}
                    {renderPriorityBadge(ticket.priority)}
                    {ticket.category && (
                      <span className="text-[11px] font-medium text-slate-400 capitalize">
                        • {ticket.category.toLowerCase()}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-sm sm:text-[15px] font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tight line-clamp-1">
                    {ticket.title}
                  </h2>

                  {/* Description snippet */}
                  {ticket.description && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 leading-relaxed max-w-2xl">
                      {ticket.description}
                    </p>
                  )}
                </div>

                {/* Right side metadata */}
                <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-emerald-700 font-medium transition-colors">
                    <span>View updates</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Footer */}
          <div className="border-t border-slate-100 px-4 sm:px-5 py-3 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Showing page <span className="font-semibold text-slate-700">{page + 1}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-8 px-3 text-xs font-medium rounded-lg border-slate-200 hover:bg-white disabled:opacity-40 gap-1 transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-3 text-xs font-medium rounded-lg border-slate-200 hover:bg-white disabled:opacity-40 gap-1 transition-all"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
