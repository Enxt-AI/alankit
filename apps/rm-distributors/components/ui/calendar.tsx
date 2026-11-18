"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarRange {
  from?: Date;
  to?: Date;
}

export interface CalendarProps {
  className?: string;
  selected?: CalendarRange;
  onSelect?: (range: CalendarRange | undefined) => void;
  defaultMonth?: Date;
  mode?: "range" | "single";
  numberOfMonths?: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function Calendar({
  className,
  selected,
  onSelect,
  defaultMonth = new Date(),
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    new Date(defaultMonth.getFullYear(), defaultMonth.getMonth(), 1)
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);
    if (!onSelect) return;

    if (!selected?.from || (selected.from && selected.to)) {
      // Start a new range
      onSelect({ from: clickedDate, to: undefined });
    } else {
      // Complete range
      if (clickedDate < selected.from) {
        onSelect({ from: clickedDate, to: undefined });
      } else {
        onSelect({ from: selected.from, to: clickedDate });
      }
    }
  };

  const isSameDay = (d1?: Date, d2?: Date) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isInRange = (d: Date) => {
    if (!selected?.from || !selected?.to) return false;
    const time = d.getTime();
    const fromTime = new Date(selected.from.getFullYear(), selected.from.getMonth(), selected.from.getDate()).getTime();
    const toTime = new Date(selected.to.getFullYear(), selected.to.getMonth(), selected.to.getDate()).getTime();
    return time > fromTime && time < toTime;
  };

  const today = new Date();

  return (
    <div className={cn("p-3 select-none", className)}>
      {/* Month Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </span>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_DAYS.map((wd) => (
          <div
            key={wd}
            className="h-8 text-[11px] font-medium text-gray-400 flex items-center justify-center"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8 w-8" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const isFrom = isSameDay(date, selected?.from);
          const isTo = isSameDay(date, selected?.to);
          const inRange = isInRange(date);
          const isCurrentDay = isSameDay(date, today);

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                "h-8 w-8 text-xs rounded-md font-medium transition-colors flex items-center justify-center relative",
                isFrom || isTo
                  ? "bg-green-600 text-white font-bold hover:bg-green-700 z-10"
                  : inRange
                  ? "bg-green-50 text-green-800 rounded-none first:rounded-l-md last:rounded-r-md hover:bg-green-100"
                  : "text-gray-700 hover:bg-gray-100",
                isCurrentDay && !isFrom && !isTo && "border border-green-500 font-bold text-green-700"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
