"use client";

import { useId, useState } from "react";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { useCompanyDetails } from "@/hooks/use-company-details";
import { Skeleton } from "@/components/ui/skeleton";

const INITIAL_SHOW_COUNT = 5;

interface BoardOfDirectorsProps {
  cin: string | null | undefined;
}

function formatDirectorName(name: string): string {
  if (!name) return "";
  const cleaned = name.replace(/^[.\s\-_]+/, "").trim();
  if (cleaned === cleaned.toUpperCase()) {
    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return cleaned;
}

function formatDesignation(designation?: string | null): string {
  if (!designation) return "Director";
  const cleaned = designation.trim();
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return cleaned;
}

export function BoardOfDirectors({ cin }: BoardOfDirectorsProps) {
  const { data, isLoading, isError } = useCompanyDetails(cin);
  const signatories = data?.authorizedSignatories ?? [];
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const headingId = useId();
  const visibleSignatories = showAll
    ? signatories
    : signatories.slice(0, INITIAL_SHOW_COUNT);
  const hasMore = signatories.length > INITIAL_SHOW_COUNT;

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <Users className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2
            id={headingId}
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            Board of Directors
          </h2>
        </div>
        {!isLoading && signatories.length > 0 && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 border border-slate-200/60">
            {signatories.length} members
          </span>
        )}
      </div>

      {isLoading ? (
        <div
          role="status"
          className="grid gap-2.5 p-3.5 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-5"
        >
          <span className="sr-only">Loading board of directors</span>
          {Array.from({ length: INITIAL_SHOW_COUNT }, (_, index) => (
            <Skeleton key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : signatories.length === 0 ? (
        <p className="px-4 py-6 text-xs sm:text-sm text-slate-500 sm:px-6">
          {isError
            ? "Board information could not be loaded. Please try again later."
            : "Board information is not available for this company yet."}
        </p>
      ) : (
        <>
          <ul
            id={listId}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 p-3.5 sm:p-5"
          >
            {visibleSignatories.map((signatory, index) => {
              const displayName = formatDirectorName(signatory.name);
              const displayDesignation = formatDesignation(signatory.designation);
              const initials = displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();

              return (
                <li
                  key={`${signatory.name}-${index}`}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-2xs p-2.5 sm:p-3 transition-all min-h-[58px]"
                  title={`${displayName}${displayDesignation ? ` — ${displayDesignation}` : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-emerald-700 border border-slate-200/80 shadow-2xs"
                  >
                    {initials || <Users className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                      {displayName}
                    </p>
                    <p className="truncate text-[10px] sm:text-[11px] font-medium text-slate-500 leading-tight mt-0.5">
                      {displayDesignation}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 sm:px-6 sm:py-3 bg-slate-50/30">
              <p className="text-xs text-slate-500" aria-live="polite">
                Showing {visibleSignatories.length} of {signatories.length} members
              </p>
              <button
                type="button"
                aria-expanded={showAll}
                aria-controls={listId}
                onClick={() => setShowAll((previous) => !previous)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                {showAll ? "Read less" : "Read more"}
                {showAll ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
