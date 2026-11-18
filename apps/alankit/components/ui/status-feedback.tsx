"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Compass,
  ServerCrash,
  Wrench,
  X,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type PopupAlertOptions = {
  code?: "404" | "503" | "500" | "INFO" | "AUTH";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

type StatusFeedbackContextValue = {
  showPopup: (options: PopupAlertOptions) => void;
  closePopup: () => void;
};

const StatusFeedbackContext = createContext<StatusFeedbackContextValue | null>(
  null
);

export function useStatusFeedback() {
  const ctx = useContext(StatusFeedbackContext);
  if (!ctx) {
    return {
      showPopup: () => {},
      closePopup: () => {},
    };
  }
  return ctx;
}

export function StatusFeedbackProvider({ children }: { children: ReactNode }) {
  const [activePopup, setActivePopup] = useState<PopupAlertOptions | null>(
    null
  );

  const showPopup = useCallback((options: PopupAlertOptions) => {
    setActivePopup(options);
  }, []);

  const closePopup = useCallback(() => {
    setActivePopup(null);
  }, []);

  return (
    <StatusFeedbackContext.Provider value={{ showPopup, closePopup }}>
      {children}

      {/* Human-Readable Modal Popup */}
      {activePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-popup-title"
          onClick={closePopup}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={closePopup}
              aria-label="Close popup"
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
            >
              <X className="size-4" />
            </button>

            {/* Icon & Status Badge */}
            <div className="flex items-center gap-3">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                  activePopup.code === "503" || activePopup.code === "500"
                    ? "bg-amber-50 text-amber-600"
                    : activePopup.code === "404"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-indigo-50 text-[#4F46E5]"
                }`}
              >
                {activePopup.code === "503" ? (
                  <Wrench className="size-5" />
                ) : activePopup.code === "404" ? (
                  <Compass className="size-5" />
                ) : activePopup.code === "500" ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <Info className="size-5" />
                )}
              </div>

              {activePopup.code && (
                <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                  {activePopup.code === "503"
                    ? "Error 503 • Service Unavailable"
                    : activePopup.code === "404"
                      ? "Error 404 • Not Found"
                      : activePopup.code === "500"
                        ? "Error 500 • System Notice"
                        : activePopup.code === "AUTH"
                          ? "Account Access"
                          : "Notice"}
                </span>
              )}
            </div>

            {/* Title & Human-Readable Explanation */}
            <h3
              id="status-popup-title"
              className="mt-4 text-lg font-medium text-zinc-900"
            >
              {activePopup.title}
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-zinc-600">
              {activePopup.message}
            </p>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={closePopup}
                className="h-9 rounded-lg border-zinc-200 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Close
              </Button>
              {activePopup.actionHref ? (
                <Link
                  href={activePopup.actionHref}
                  onClick={closePopup}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[#4F46E5] px-4 text-xs font-medium text-white transition-colors hover:bg-[#4338CA]"
                >
                  {activePopup.actionLabel || "Continue"}
                </Link>
              ) : (
                <Button
                  onClick={closePopup}
                  className="h-9 rounded-lg bg-[#4F46E5] px-4 text-xs font-medium text-white hover:bg-[#4338CA] cursor-pointer"
                >
                  {activePopup.actionLabel || "Got it"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </StatusFeedbackContext.Provider>
  );
}

type StatusPageViewProps = {
  code: "404" | "500" | "503";
  title: string;
  description: string;
  suggestion?: string;
  onRetry?: () => void;
};

export function StatusPageView({
  code,
  title,
  description,
  suggestion,
  onRetry,
}: StatusPageViewProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-white px-6 py-20 text-center">
      {/* Subtle Background Geometric Watermark */}
      <div
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.035]"
        aria-hidden="true"
      >
        <svg
          className="size-[420px] sm:size-[520px] text-zinc-900"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            stroke="currentColor"
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="72"
              y="72"
              width="128"
              height="128"
              rx="48"
              transform="rotate(-45 136 136)"
            />
            <rect
              x="200"
              y="72"
              width="128"
              height="128"
              rx="48"
              transform="rotate(45 264 136)"
            />
            <rect
              x="72"
              y="200"
              width="128"
              height="128"
              rx="48"
              transform="rotate(45 136 264)"
            />
            <rect
              x="200"
              y="200"
              width="128"
              height="128"
              rx="48"
              transform="rotate(-45 264 264)"
            />
          </g>
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-lg">
        {/* Icon Badge */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-indigo-50 text-[#4F46E5] shadow-2xs ring-1 ring-indigo-100">
          {code === "404" && <Compass className="size-8" />}
          {code === "503" && <Wrench className="size-8" />}
          {code === "500" && <ServerCrash className="size-8" />}
        </div>

        {/* Status Code Pill */}
        <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-700">
          Error {code}
        </span>

        {/* Human-Readable Heading */}
        <h1 className="mt-4 text-3xl font-normal tracking-tight text-zinc-900 sm:text-4xl">
          {title}
        </h1>

        {/* Plain-Language Explanation */}
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
          {description}
        </p>

        {suggestion && (
          <p className="mt-2 text-xs text-zinc-500">{suggestion}</p>
        )}

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="h-10 rounded-lg bg-[#0E171B] px-5 text-xs sm:text-sm font-medium text-white hover:bg-[#19262C] cursor-pointer"
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Try Again
            </Button>
          )}

          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#4F46E5] px-5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-[#4338CA]"
          >
            <ArrowLeft className="size-3.5" />
            Back to Home
          </Link>

          <Link
            href="/stocks"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-5 text-xs sm:text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <TrendingUp className="size-3.5 text-[#4D9A78]" />
            Explore Stocks
          </Link>
        </div>

        {/* Quick Links to Popular Stocks */}
        <div className="mt-10 border-t border-zinc-100 pt-6">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Popular Stocks
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {[
              { ticker: "TATACAP", name: "Tata Capital", href: "/stocks/tatacap" },
              { ticker: "NSE", name: "NSE India", href: "/stocks/nse" },
              { ticker: "HDBFIN", name: "HDB Financial", href: "/stocks/hdbfin" },
              { ticker: "SWIGGY", name: "Swiggy", href: "/stocks/swiggy" },
            ].map((item) => (
              <Link
                key={item.ticker}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-[#4F46E5]"
              >
                <span className="font-semibold">{item.ticker}</span>
                <span className="text-zinc-400">•</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

