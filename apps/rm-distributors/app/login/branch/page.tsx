"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ChevronDown, Check, Search, X } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth-headers";
import { resolveApiUrl } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

type BranchOption = { id: string; name: string };

export default function BranchLogin() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchId, setBranchId] = useState("");
  const [branchQuery, setBranchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load active branches for the dropdown
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          resolveApiUrl("/api/auth/branch/login-options"),
          {
            headers: { ...getAuthHeaders() },
            credentials: "include",
          },
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.branches)) throw new Error();
        if (!cancelled) setBranches(data.branches);
      } catch {
        if (!cancelled)
          setError("Unable to load branches. Please refresh the page.");
      } finally {
        if (!cancelled) setBranchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === branchId) || null,
    [branches, branchId],
  );

  const filteredBranches = useMemo(() => {
    const q = branchQuery.trim().toLowerCase();
    // If query exactly matches the currently selected branch name, show all branches
    // so clicking the dropdown arrow still lets the user browse the full list
    if (!q || (selectedBranch && q === selectedBranch.name.toLowerCase())) {
      return branches;
    }
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchQuery, selectedBranch]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [branchQuery, dropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
        // Restore selected branch label if user typed something without picking
        if (selectedBranch) {
          setBranchQuery(selectedBranch.name);
        } else {
          setBranchQuery("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedBranch]);

  const handleSelectBranch = (branch: BranchOption) => {
    setBranchId(branch.id);
    setBranchQuery(branch.name);
    setDropdownOpen(false);
  };

  const handleClearBranch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBranchId("");
    setBranchQuery("");
    setDropdownOpen(true);
    branchInputRef.current?.focus();
  };

  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!dropdownOpen) {
        setDropdownOpen(true);
      } else if (filteredBranches.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredBranches.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!dropdownOpen) {
        setDropdownOpen(true);
      } else if (filteredBranches.length > 0) {
        setHighlightedIndex(
          (prev) =>
            (prev - 1 + filteredBranches.length) % filteredBranches.length,
        );
      }
    } else if (e.key === "Enter" && dropdownOpen) {
      e.preventDefault();
      const target = filteredBranches[highlightedIndex];
      if (target) {
        handleSelectBranch(target);
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      if (selectedBranch) {
        setBranchQuery(selectedBranch.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setError("Please select your branch.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(resolveApiUrl("/api/auth/branch/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          branchId,
          email: email.trim(),
          password: password.trim(),
        }),
      });

      let data: any = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        let errorText = "Failed to sign in";
        if (data && data.message) {
          const msg = data.message;
          if (typeof msg === "string") {
            errorText = msg;
          } else if (Array.isArray(msg)) {
            const texts = msg.map((m: any) => {
              if (typeof m === "string") return m;
              if (m?.constraints)
                return Object.values(m.constraints).join(", ");
              return String(m);
            });
            errorText = texts.join(". ");
          }
        } else {
          // Map HTTP status codes to user-friendly messages
          if (response.status === 401) {
            errorText = "Invalid email or password. Please try again.";
          } else if (response.status === 429) {
            errorText = "Too many login attempts. Please try again later.";
          } else if (response.status >= 500) {
            errorText =
              "We're experiencing temporary issues. Please try again in a few moments.";
          } else {
            errorText = "Unable to sign in. Please try again.";
          }
        }
        throw new Error(errorText);
      }

      // Check if this is a branch
      if (data && data.distributor && !data.distributor.isBranch) {
        throw new Error(
          "This account is registered as a Distributor. Please log in on the Distributor page.",
        );
      }

      // Navigate to dashboard
      localStorage.setItem("userType", "branch");
      router.push("/branch");
    } catch (err: any) {
      const msg = err.message || "Something went wrong. Please try again.";
      // Sanitize any leaked technical details
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("NetworkError") ||
        msg.includes("Failed to fetch")
      ) {
        setError(
          "Unable to connect. Please check your internet connection and try again.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-hover:-translate-x-1"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to roles
        </Link>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {" "}
              Branch Login
            </CardTitle>
            <CardDescription>Sign in to your Branch portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm font-medium text-red-500 bg-red-50 rounded-md border border-red-100">
                  {error}
                </div>
              )}
              <div className="space-y-2" ref={comboboxRef}>
                <Label htmlFor="branch">Branch</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={branchInputRef}
                    id="branch"
                    type="text"
                    role="combobox"
                    aria-expanded={dropdownOpen}
                    aria-autocomplete="list"
                    autoComplete="off"
                    disabled={branchesLoading || branches.length === 0}
                    placeholder={
                      branchesLoading
                        ? "Loading branches..."
                        : "Search or select your branch..."
                    }
                    value={branchQuery}
                    onFocus={() => setDropdownOpen(true)}
                    onClick={() => setDropdownOpen(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBranchQuery(val);
                      setDropdownOpen(true);
                      // Clear selected branchId if user modifies text away from selected name
                      if (selectedBranch && val !== selectedBranch.name) {
                        setBranchId("");
                      }
                    }}
                    onKeyDown={handleBranchKeyDown}
                    className="h-10 pl-9 pr-14 border-border focus-visible:ring-primary focus-visible:border-primary"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {branchQuery && !branchesLoading && (
                      <button
                        type="button"
                        onClick={handleClearBranch}
                        aria-label="Clear branch selection"
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled={branchesLoading || branches.length === 0}
                      onClick={() => {
                        setDropdownOpen((prev) => !prev);
                        branchInputRef.current?.focus();
                      }}
                      aria-label="Toggle branch dropdown"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded disabled:opacity-50"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-150",
                          dropdownOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </div>

                  {dropdownOpen && !branchesLoading && (
                    <div
                      role="listbox"
                      className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                    >
                      {filteredBranches.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No matching branch found.
                        </div>
                      ) : (
                        filteredBranches.map((b, idx) => {
                          const isSelected = b.id === branchId;
                          const isHighlighted = idx === highlightedIndex;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              onMouseDown={(e) => {
                                // Prevent input blur before selection runs
                                e.preventDefault();
                                handleSelectBranch(b);
                              }}
                              className={cn(
                                "relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm px-2.5 py-2 text-left text-sm outline-none transition-colors",
                                (isHighlighted || isSelected) &&
                                  "bg-accent text-accent-foreground",
                                isSelected && "font-medium",
                              )}
                            >
                              <span className="truncate pr-2">{b.name}</span>
                              {isSelected && (
                                <Check className="h-4 w-4 shrink-0 text-primary" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@india.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 border-border focus-visible:ring-primary focus-visible:border-primary"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/change-password?portal=branch"
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 border-border focus-visible:ring-primary focus-visible:border-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-10 font-semibold"
                disabled={isLoading || !branchId}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
