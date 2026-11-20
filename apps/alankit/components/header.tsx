"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/logo.png";
import { useAuthSession } from "@/lib/auth";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu, User, X } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string; description?: string }[];
};

const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Stocks", href: "/stocks" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Support", href: "/support" },
];

export function Header() {
  const isAuthenticated = useAuthSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="w-full bg-white border-b border-zinc-100">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src={logo} alt="UnlistedStocx" className="h-auto w-40 sm:w-48" preload />
        </Link>

        {/* Center Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-7">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`text-sm transition-colors ${
                  isActive
                    ? "font-medium text-zinc-900 underline underline-offset-4 decoration-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Account controls depend on the current session. */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && <>
          <Link
            href="/notifications"
            title="Notifications"
            aria-label="Notifications"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <Bell className="size-4" />
          </Link>
          <Link
            href="/profile"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <User className="size-4 text-[#2563EB]" />
            <span>Profile</span>
          </Link>
          </>}

          {!isAuthenticated && <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2563EB] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            Sign In
          </Link>}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 md:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <X className="size-5" />
          ) : (
            <Menu className="size-5" />
          )}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-zinc-100 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col space-y-3">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm py-1 ${
                    isActive
                      ? "font-medium text-zinc-900 underline underline-offset-4"
                      : "text-zinc-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex flex-col gap-2.5 border-t border-zinc-100 pt-4">
            {isAuthenticated && <>
            <Link
              href="/notifications"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Notifications"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-800"
            >
              <Bell className="size-4" />
              <span>Notifications</span>
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-800"
            >
              <User className="size-4 text-[#2563EB]" />
              <span>Profile</span>
            </Link>
            </>}
            {!isAuthenticated && <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#2563EB] text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
              Sign In
            </Link>}
          </div>
        </div>
      )}
    </header>
  );
}
