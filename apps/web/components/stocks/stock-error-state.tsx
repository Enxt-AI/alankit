import { AlertCircle, Search, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StockErrorStateProps {
  type: "error" | "not-found";
  title?: string;
  description?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  onClearSearch?: () => void;
  onAdjustFilters?: () => void;
  className?: string;
}

export function StockErrorState({
  type,
  title,
  description,
  onRetry,
  onGoBack,
  onClearSearch,
  onAdjustFilters,
  className = "",
}: StockErrorStateProps) {
  const isError = type === "error";

  if (!isError) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center w-full ${className}`}>
        <div className="relative mb-6">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center relative">
            <Search className="w-12 h-12 text-[#057A55]" strokeWidth={2} />
            {/* tiny stars */}
            <span className="absolute top-2 left-1 text-[#34D399] font-serif text-xl">✦</span>
            <span className="absolute top-8 -right-2 text-[#34D399] font-serif text-base">✦</span>
            <span className="absolute bottom-3 left-3 text-[#34D399] font-serif text-sm">✧</span>
          </div>
        </div>
        <h3 className="text-[26px] font-bold text-[#1A2530] mb-3">
          {title || "No Stocks Found"}
        </h3>
        <p className="text-slate-500 max-w-[380px] mb-8 leading-relaxed text-base">
          {description || "We couldn't find any stocks matching your current search criteria. Try adjusting your filters or search terms."}
        </p>
        
        
      </div>
    );
  }

  // Configuration based on state type
  const config = {
    icon: AlertCircle,
    defaultTitle: "Failed to Load Data",
    defaultDescription: "We encountered an issue while loading the stock details. Please try again.",
    iconColor: "text-rose-500",
    iconBg: "bg-rose-100/50",
    iconGlow: "shadow-[0_0_30px_rgba(244,63,94,0.15)]",
    bgPattern: "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-50/40 via-white to-white",
  };

  const Icon = config.icon;

  return (
    <div
      className={`relative w-full max-w-xl mx-auto rounded-3xl bg-slate-50/60 overflow-hidden ${className}`}
    >
      {/* Decorative Top Gradient Background */}
      <div className={`absolute inset-0 ${config.bgPattern} pointer-events-none`} />

      <div className="relative px-6 py-14 flex flex-col items-center justify-center text-center">
        {/* Animated Icon Container */}
        <div className="relative mb-6">
          <div className={`absolute inset-0 rounded-full ${config.iconGlow} blur-xl`} />
          <div
            className={`relative flex h-20 w-20 items-center justify-center rounded-2xl ${config.iconBg} backdrop-blur-sm`}
          >
            <Icon
              className={`h-10 w-10 ${config.iconColor} animate-[pulse_3s_ease-in-out_infinite]`}
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Text Content */}
        <h3 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 font-sans">
          {title || config.defaultTitle}
        </h3>
        <p className="mb-8 max-w-md text-sm md:text-base text-slate-500 leading-relaxed font-normal">
          {description || config.defaultDescription}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {onGoBack && (
            <Button
              onClick={onGoBack}
              variant="ghost"
              className="w-full sm:w-auto px-6 h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-medium transition-all"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          )}

          {onRetry && (
            <Button
              onClick={onRetry}
              className={`w-full sm:w-auto px-6 h-11 rounded-xl text-white font-medium transition-all bg-rose-600 hover:bg-rose-700 focus:ring-rose-500`}
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
