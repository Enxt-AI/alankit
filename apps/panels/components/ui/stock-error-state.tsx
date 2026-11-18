import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StockErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function StockErrorState({
  title = "Failed to Load Data",
  description = "An error occurred while attempting to fetch the stock information. Please try again.",
  onRetry,
  className = "",
}: StockErrorStateProps) {
  return (
    <div
      className={`relative w-full rounded-lg border border-red-100 bg-red-50/50 p-8 shadow-sm ${className}`}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-7 w-7" strokeWidth={2} />
        </div>
        
        <h3 className="mb-2 text-xl font-semibold text-gray-900">
          {title}
        </h3>
        
        <p className="mb-6 max-w-sm text-sm text-gray-500 text-center">
          {description}
        </p>

        {onRetry && (
          <Button
            onClick={onRetry}
            variant="default"
            className="bg-red-600 hover:bg-red-700 text-white min-w-[120px]"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
