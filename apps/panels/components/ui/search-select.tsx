"use client";

import * as React from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchSelectOption {
  id: string;
  name: string;
  code?: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Search account...",
  disabled = false,
  className,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Find selected option
  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.id === value);
  }, [options, value]);

  // Click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Reset search query when dropdown closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(query) ||
        opt.code?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchQuery("");
    inputRef.current?.blur();
  };

  const displayValue = React.useMemo(() => {
    if (isOpen) {
      return searchQuery;
    }
    if (selectedOption) {
      return selectedOption.name + (selectedOption.code ? ` (${selectedOption.code})` : "");
    }
    return "";
  }, [isOpen, searchQuery, selectedOption]);

  const handleFocus = () => {
    setIsOpen(true);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full inline-block", className)}
    >
      {/* Search Input Box (Direct Search Bar) */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={selectedOption ? undefined : placeholder}
          value={displayValue}
          onFocus={handleFocus}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          className={cn(
            "flex h-[38px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-2 text-xs font-semibold text-slate-800 transition-all duration-200 outline-none shadow-sm placeholder:text-slate-400 placeholder:font-medium",
            "hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100",
            disabled && "cursor-not-allowed opacity-50 bg-slate-50",
            isOpen && "border-emerald-400 ring-2 ring-emerald-100"
          )}
        />
        <ChevronDown
          onClick={() => {
            if (!disabled) {
              if (isOpen) {
                inputRef.current?.blur();
                setIsOpen(false);
              } else {
                inputRef.current?.focus();
              }
            }
          }}
          className={cn(
            "absolute right-3 h-4 w-4 text-slate-400 cursor-pointer shrink-0 transition-transform duration-200",
            isOpen && "transform rotate-180"
          )}
        />
      </div>

      {/* Dropdown Options List */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-full min-w-[240px] rounded-2xl border border-slate-100 bg-white shadow-xl p-2",
            "animate-in fade-in slide-in-from-top-2 duration-150 origin-top"
          )}
        >
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left font-medium transition-all duration-150",
                      isSelected
                        ? "bg-emerald-50 text-emerald-950 font-bold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span className="truncate">
                      {opt.name}
                      {opt.code && (
                        <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                          ({opt.code})
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-6 px-3 text-center text-xs text-slate-400 font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-100">
                No matching accounts found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
