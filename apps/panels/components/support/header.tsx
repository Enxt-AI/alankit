"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useSupportAuth } from "@/hooks/use-support-auth";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Menu,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  ChevronRight,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ActiveSessionsDialog from "@/components/shared/active-sessions-dialog";

interface SupportHeaderProps {
  onMenuClick: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SupportHeader({
  onMenuClick,
  collapsed,
  onToggleCollapse,
}: SupportHeaderProps) {
  const { supportAdmin } = useSupportAuth();
  const { supportLogout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const handleLogout = async () => {
    await supportLogout();
    window.location.href = withBasePath("/support/login?clear=true");
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return "S";
    return fullName
      .split(" ")
      .filter(Boolean)
      .map((name) => name.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "SUPPORT_AGENT":
        return "Support Agent";
      case "SUPER_ADMIN":
        return "Super Admin";
      default:
        return role ? role.replace("_", " ") : "Agent";
    }
  };

  // Resolve section name for breadcrumb
  const getBreadcrumbTitle = () => {
    if (pathname.includes("/support/dashboard")) return "Dashboard";
    if (pathname.includes("/support/tickets")) return "Tickets";
    if (pathname.includes("/support/reports")) return "Reports";
    if (pathname.includes("/support/profile")) return "Profile";
    return "Support Desk";
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 transition-all">
        {/* Left Section */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Hamburger Menu Button (mobile only) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 rounded-xl"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors rounded-xl h-9 w-9"
              onClick={onToggleCollapse}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400 font-medium">
              <LifeBuoy className="w-3.5 h-3.5 text-emerald-600" />
              <span> Support</span>
            </span>
            <ChevronRight className="hidden sm:inline-block w-3 h-3 text-slate-300" />
            <span className="text-slate-800 font-bold bg-slate-100/70 px-2.5 py-1 rounded-lg border border-slate-200/50">
              {getBreadcrumbTitle()}
            </span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* System Status Pill */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/60 text-emerald-700 text-[11px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Desk Online</span>
          </div>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none">
                <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-emerald-500/20 hover:ring-emerald-500/40 transition-all duration-200 shadow-xs">
                  <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-teal-500 text-white text-xs font-bold">
                    {getInitials(
                      supportAdmin?.fullName || supportAdmin?.email || "S",
                    )}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-2xl border border-slate-200/80 shadow-xl p-1.5 bg-white backdrop-blur-xl animate-in fade-in-50 zoom-in-95"
            >
              <DropdownMenuLabel className="text-slate-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5">
                Support Identity
              </DropdownMenuLabel>

              {/* User Info Card */}
              <div className="px-3 py-3 bg-gradient-to-br from-slate-50 to-slate-100/70 rounded-xl border border-slate-200/60 m-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                    <span className="text-xs font-extrabold">
                      {getInitials(
                        supportAdmin?.fullName || supportAdmin?.email || "S",
                      )}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {supportAdmin?.fullName || "Agent"}
                    </p>
                    <p className="text-[10px] font-medium text-slate-500 truncate">
                      {supportAdmin?.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-200/50">
                  <Badge className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/40 text-[9px] font-extrabold text-emerald-800 tracking-wider rounded-md px-2 py-0.5 uppercase shadow-2xs">
                    {getRoleDisplayName(supportAdmin?.role || "")}
                  </Badge>
                  {supportAdmin?.role === "SUPER_ADMIN" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Full Access
                    </span>
                  )}
                </div>
              </div>

              <DropdownMenuSeparator className="bg-slate-100 my-1" />

              <DropdownMenuItem
                onClick={() => router.push("/support/profile")}
                className="cursor-pointer rounded-xl m-0.5 text-xs font-semibold py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900 transition-colors"
              >
                <User className="mr-2.5 h-4 w-4 text-slate-400" />
                <span>Profile Settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setSessionsOpen(true)}
                className="cursor-pointer rounded-xl m-0.5 text-xs font-semibold py-2.5 text-slate-700 hover:text-slate-900 hover:bg-emerald-50 focus:bg-emerald-50 focus:text-emerald-700 transition-colors"
              >
                <Shield className="mr-2.5 h-4 w-4 text-emerald-600" />
                <span>Active Sessions</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-slate-100 my-1" />

              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer rounded-xl m-0.5 text-xs font-semibold py-2.5 text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-700 transition-colors"
              >
                <LogOut className="mr-2.5 h-4 w-4 text-red-500" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ActiveSessionsDialog
        open={sessionsOpen}
        onOpenChange={setSessionsOpen}
      />
    </>
  );
}
