"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
  preset?: string;   // 'today' | 'yesterday' | '7days' | 'month' | 'last-month' | 'all' | 'custom'
  onApply: (range: { fromDate: string; toDate: string; preset: string }) => void;
  className?: string;
}

function parseDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return undefined;
  const [y, m, d] = parts;
  return new Date(y!, m! - 1, d!);
}

function formatDateToDb(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateToDisplay(dateStr?: string): string {
  if (!dateStr) return "DD-MM-YYYY";
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function DatePicker({
  fromDate = "",
  toDate = "",
  preset = "all",
  onApply,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Temporary date range state while popover is open
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(() => {
    const s = parseDate(fromDate);
    const e = parseDate(toDate);
    if (!s && !e) return undefined;
    return { from: s, to: e || s };
  });

  const [tempPreset, setTempPreset] = React.useState<string>(preset);

  // Current calendar month navigation
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => {
    const s = parseDate(fromDate);
    return s || new Date();
  });

  // Sync internal state when popover opens or props change
  React.useEffect(() => {
    if (isOpen) {
      const s = parseDate(fromDate);
      const e = parseDate(toDate);
      setTempRange(s || e ? { from: s, to: e || s } : undefined);
      setTempPreset(preset);
      if (s) {
        setCalendarMonth(s);
      }
    }
  }, [isOpen, fromDate, toDate, preset]);

  // Handle Preset Selection
  const handlePresetSelect = (p: string) => {
    const today = new Date();
    const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (p === "today") {
      setTempRange({ from: todayClean, to: todayClean });
      setTempPreset("today");
      setCalendarMonth(todayClean);
    } else if (p === "yesterday") {
      const y = new Date(todayClean);
      y.setDate(todayClean.getDate() - 1);
      setTempRange({ from: y, to: y });
      setTempPreset("yesterday");
      setCalendarMonth(y);
    } else if (p === "7days") {
      const start = new Date(todayClean);
      start.setDate(todayClean.getDate() - 6);
      setTempRange({ from: start, to: todayClean });
      setTempPreset("7days");
      setCalendarMonth(start);
    } else if (p === "month") {
      const first = new Date(todayClean.getFullYear(), todayClean.getMonth(), 1);
      setTempRange({ from: first, to: todayClean });
      setTempPreset("month");
      setCalendarMonth(first);
    } else if (p === "last-month") {
      const first = new Date(todayClean.getFullYear(), todayClean.getMonth() - 1, 1);
      const last = new Date(todayClean.getFullYear(), todayClean.getMonth(), 0);
      setTempRange({ from: first, to: last });
      setTempPreset("last-month");
      setCalendarMonth(first);
    } else if (p === "all") {
      setTempRange(undefined);
      setTempPreset("all");
    } else if (p === "custom") {
      setTempPreset("custom");
    }
  };

  // Handle Apply button click
  const handleApply = () => {
    let fromStr = "";
    let toStr = "";

    if (tempPreset === "all" || !tempRange?.from) {
      fromStr = "";
      toStr = "";
    } else {
      fromStr = formatDateToDb(tempRange.from);
      toStr = tempRange.to ? formatDateToDb(tempRange.to) : fromStr;
    }

    onApply({
      fromDate: fromStr,
      toDate: toStr,
      preset: tempPreset,
    });
    setIsOpen(false);
  };

  // Compute trigger button display label
  const getDisplayTriggerLabel = () => {
    if (preset === "today") return "Today";
    if (preset === "yesterday") return "Yesterday";
    if (preset === "7days") return "Last 7 Days";
    if (preset === "month") return "This Month";
    if (preset === "last-month") return "Last Month";
    if (preset === "all" || (!fromDate && !toDate)) return "All Dates";
    if (fromDate && toDate) {
      if (fromDate === toDate) return formatDateToDisplay(fromDate);
      return `${formatDateToDisplay(fromDate)} to ${formatDateToDisplay(toDate)}`;
    }
    return "Custom Range";
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        {/* Trigger Button using shadcn Button */}
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 px-4 bg-white border rounded-lg text-xs font-medium shadow-xs flex items-center gap-2 cursor-pointer transition-colors outline-none",
              isOpen
                ? "border-[#6D28D9] text-[#6D28D9] bg-[#F3E8FF]/30 hover:bg-[#F3E8FF]/40 hover:text-[#6D28D9]"
                : "border-[#E5E7EB] hover:border-[#D1D5DB] text-[#374151] hover:bg-neutral-50"
            )}
          >
            <span>{getDisplayTriggerLabel()}</span>
            {isOpen ? (
              <ChevronUp size={14} className="text-[#6D28D9]" />
            ) : (
              <ChevronDown size={14} className="text-[#6B7280]" />
            )}
          </Button>
        </PopoverTrigger>

        {/* Popover Content using shadcn PopoverContent */}
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-auto p-0 z-50 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex divide-x divide-neutral-100">
            {/* Left Sidebar Presets */}
            <div className="w-44 py-3 px-2 flex flex-col gap-1 bg-white shrink-0">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "7days", label: "Last 7 days" },
                { id: "month", label: "This Month" },
                { id: "last-month", label: "Last Month" },
                { id: "all", label: "All Time" },
                { id: "custom", label: "Custom Date Range" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePresetSelect(item.id)}
                  className={cn(
                    "text-left px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer",
                    tempPreset === item.id
                      ? "bg-[#F3E8FF] text-[#6D28D9] font-semibold"
                      : "text-[#374151] hover:bg-neutral-50 font-medium"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right Main Panel */}
            <div className="flex flex-col">
              {/* Header: From, To & Apply Button */}
              <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-neutral-100">
                <div className="flex items-center gap-8">
                  {/* From Field */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6B7280] font-medium leading-none mb-1">
                      From
                    </span>
                    <span className="text-sm font-semibold text-[#111827]">
                      {tempRange?.from
                        ? formatDateToDisplay(formatDateToDb(tempRange.from))
                        : "DD-MM-YYYY"}
                    </span>
                  </div>

                  {/* To Field */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#6B7280] font-medium leading-none mb-1">
                      To
                    </span>
                    <span className="text-sm font-semibold text-[#111827]">
                      {tempRange?.to
                        ? formatDateToDisplay(formatDateToDb(tempRange.to))
                        : tempRange?.from
                        ? formatDateToDisplay(formatDateToDb(tempRange.from))
                        : "DD-MM-YYYY"}
                    </span>
                  </div>
                </div>

                {/* Apply Button */}
                <Button
                  type="button"
                  onClick={handleApply}
                  className="bg-[#6D28D9] hover:bg-[#5B21B6] active:bg-[#4C1D95] text-white px-6 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer h-auto"
                >
                  Apply
                </Button>
              </div>

              {/* Dual Month Calendar using shadcn Calendar */}
              <div className="p-3">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={tempRange}
                  onSelect={(range) => {
                    setTempRange(range);
                    setTempPreset("custom");
                  }}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  classNames={{
                    months: "flex flex-row space-x-6",
                    month: "space-y-3",
                    month_caption: "flex justify-center pt-1 relative items-center mb-1",
                    caption_label: "text-xs font-bold text-[#1E1B4B]",
                    button_previous: "h-7 w-7 bg-transparent hover:bg-purple-50 text-[#6D28D9] p-0 rounded-md absolute left-4 top-4 z-10 border-0 shadow-none cursor-pointer flex items-center justify-center opacity-100",
                    button_next: "h-7 w-7 bg-transparent hover:bg-purple-50 text-[#6D28D9] p-0 rounded-md absolute right-4 top-4 z-10 border-0 shadow-none cursor-pointer flex items-center justify-center opacity-100",
                    selected: "!bg-[#6D28D9] !text-white hover:!bg-[#6D28D9] hover:!text-white focus:!bg-[#6D28D9] focus:!text-white rounded-full font-bold",
                    range_start: "!rounded-full !bg-[#6D28D9] !text-white font-bold",
                    range_end: "!rounded-full !bg-[#6D28D9] !text-white font-bold",
                    range_middle: "aria-selected:!bg-[#EDE9FE] aria-selected:!text-[#1E1B4B] !rounded-none font-semibold",
                    day: "h-9 w-9 p-0 font-medium text-xs rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors cursor-pointer",
                    today: "font-bold text-[#6D28D9]",
                    weekday: "text-[#6B7280] font-medium text-[11px] w-9 text-center",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Footer Note (Matching user screenshot) */}
          <div className="bg-[#FEFCE8] text-[#854D0E] text-[11px] font-medium py-2.5 px-6 border-t border-[#FEF08A]/70 flex items-center justify-center gap-1">
            <span>
              Orders older than <strong className="font-semibold text-[#713F12]">1st April 2025</strong> can only be accessed through{" "}
              <a href={withBasePath('/operation/reports')} className="underline font-semibold text-[#713F12] hover:text-[#451A03]">
                Reports page
              </a>
              .
            </span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DatePicker;
