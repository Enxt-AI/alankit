"use client";

import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStr(str?: string): Date | undefined {
  if (!str) return undefined;
  const parts = str.split("-");
  if (parts.length !== 3) return undefined;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return undefined;
  return new Date(y, m, d);
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = parseDateStr(dateStr);
    if (!d) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className,
  triggerClassName,
  placeholder = "Filter by Date Range",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedRange: DateRange | undefined = React.useMemo(() => {
    if (!startDate && !endDate) return undefined;
    return {
      from: parseDateStr(startDate),
      to: parseDateStr(endDate),
    };
  }, [startDate, endDate]);

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      onChange({ startDate: "", endDate: "" });
      return;
    }
    const fromStr = range.from ? formatDateStr(range.from) : "";
    const toStr = range.to ? formatDateStr(range.to) : fromStr;
    onChange({ startDate: fromStr, endDate: toStr });
  };

  const handlePreset = (days: number | "this-month" | "last-month" | "today" | "yesterday") => {
    const today = new Date();
    let from: Date;
    let to: Date = today;

    if (days === "today") {
      from = today;
      to = today;
    } else if (days === "yesterday") {
      from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    } else if (days === "this-month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
    } else if (days === "last-month") {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    }

    onChange({
      startDate: formatDateStr(from),
      endDate: formatDateStr(to),
    });
    setOpen(false);
  };

  const formattedDisplay = React.useMemo(() => {
    if (!startDate && !endDate) return null;
    if (startDate && endDate) {
      if (startDate === endDate) {
        return formatDisplayDate(startDate);
      }
      return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
    } else if (startDate) {
      return `From ${formatDisplayDate(startDate)}`;
    } else if (endDate) {
      return `To ${formatDisplayDate(endDate)}`;
    }
    return null;
  }, [startDate, endDate]);

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-1.5">
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 justify-start text-left font-normal text-xs bg-white border-neutral-200/70 hover:bg-neutral-50 shadow-sm rounded-xl px-3",
                !formattedDisplay && "text-slate-500",
                triggerClassName
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-[#64748B] shrink-0" />
              <span className="truncate">{formattedDisplay || placeholder}</span>
            </Button>
          </PopoverTrigger>

          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ startDate: "", endDate: "" });
              }}
              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
              title="Clear date filter"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <PopoverContent className="w-auto p-0 z-[100] bg-white rounded-2xl shadow-xl border border-neutral-200/80 overflow-hidden" align="end">
          <div className="flex flex-col sm:flex-row">
            {/* Quick Presets */}
            <div className="flex flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-neutral-100 bg-neutral-50/60 min-w-[130px]">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Presets
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 px-2 font-normal text-slate-700 hover:bg-neutral-200/60 rounded-lg"
                onClick={() => handlePreset("today")}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 px-2 font-normal text-slate-700 hover:bg-neutral-200/60 rounded-lg"
                onClick={() => handlePreset("yesterday")}
              >
                Yesterday
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 px-2 font-normal text-slate-700 hover:bg-neutral-200/60 rounded-lg"
                onClick={() => handlePreset(7)}
              >
                Last 7 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 px-2 font-normal text-slate-700 hover:bg-neutral-200/60 rounded-lg"
                onClick={() => handlePreset(30)}
              >
                Last 30 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 px-2 font-normal text-slate-700 hover:bg-neutral-200/60 rounded-lg"
                onClick={() => handlePreset("this-month")}
              >
                This month
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-7 px-2 font-normal text-slate-700 hover:bg-neutral-200/60 rounded-lg"
                onClick={() => handlePreset("last-month")}
              >
                Last month
              </Button>
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-xs h-7 px-2 font-medium text-red-600 hover:bg-red-50 rounded-lg mt-1"
                  onClick={() => {
                    onChange({ startDate: "", endDate: "" });
                    setOpen(false);
                  }}
                >
                  Clear filter
                </Button>
              )}
            </div>

            {/* Calendar */}
            <div className="p-2">
              <Calendar
                mode="range"
                defaultMonth={selectedRange?.from || new Date()}
                selected={selectedRange}
                onSelect={handleSelect}
                numberOfMonths={1}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
