"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
} from "lucide-react";
import { notify } from "@/components/ui/floating-notification";

import { useAuthStore } from "@/store/auth-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ActiveSessionsDialog from "@/components/shared/active-sessions-dialog";

interface CMSHeaderProps {
  onMenuClick: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function CMSHeader({
  onMenuClick,
  collapsed,
  onToggleCollapse,
}: CMSHeaderProps) {
  const { cmsAdmin, cmsLogout } = useAuthStore();
  const router = useRouter();
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await cmsLogout();
      router.push("/cms/login");
      notify.success("Logged out successfully");
    } catch (error) {
      notify.error("Logout failed. Please try again.");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "C";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2 && parts[0]?.[0] && parts[1]?.[0]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts[0]?.[0]) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-200/40 bg-white/80 backdrop-blur-md px-6 py-4 lg:px-8">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Hamburger Menu Button (mobile only) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden text-[#64748B] hover:text-[#0F172A] hover:bg-neutral-100/60 rounded-lg"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] transition-colors"
              onClick={onToggleCollapse}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* App Title */}
          <h1
            className="text-[14px] font-extrabold tracking-tight text-[#0F172A] cursor-pointer"
            onClick={() => router.push("/cms/dashboard")}
            title="Go to Dashboard"
          >
            <span className="text-[#16A34A]"></span> CMS Panel
          </h1>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-[#16A34A]/10 hover:ring-[#16A34A]/25 transition-all duration-200">
                <AvatarFallback className="bg-[#ECFDF5] text-[#16A34A] text-sm font-bold border border-[#16A34A]/10">
                  {getInitials(cmsAdmin?.fullName || cmsAdmin?.email || "C")}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-xl border border-neutral-200/40 shadow-lg p-1.5 bg-white"
            >
              <DropdownMenuLabel className="text-[#64748B] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5">
                My Account
              </DropdownMenuLabel>

              {/* User Info Section */}
              <div className="px-2 py-3 bg-[#FAFBFC] rounded-lg border border-neutral-200/40 m-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10">
                    <span className="text-sm font-bold text-[#16A34A]">
                      {getInitials(
                        cmsAdmin?.fullName || cmsAdmin?.email || "C",
                      )}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] truncate">
                      {cmsAdmin?.fullName}
                    </p>
                    <p className="text-[10px] font-medium text-[#64748B] truncate">
                      {cmsAdmin?.email}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge className="bg-[#ECFDF5] hover:bg-[#DCFCE7] border border-[#16A34A]/20 text-[10px] font-bold text-[#16A34A] tracking-wider rounded px-2 py-0.5 uppercase transition-all duration-250">
                    {cmsAdmin?.role === "SUPER_ADMIN"
                      ? "Super Admin"
                      : "Content Manager"}
                  </Badge>
                  {cmsAdmin?.permissions && (
                    <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                      {cmsAdmin.permissions.length} Perms
                    </span>
                  )}
                </div>
              </div>

              <DropdownMenuSeparator className="bg-neutral-100" />

              <DropdownMenuItem
                onClick={() => setSessionsOpen(true)}
                className="cursor-pointer rounded-lg text-[#334155] focus:bg-[#ECFDF5] focus:text-[#16A34A] m-0.5 text-xs font-semibold py-2"
              >
                <Shield className="mr-2 h-4 w-4" />
                <span>Active Sessions</span>
              </DropdownMenuItem>

              {/* Logout MenuItem */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700 m-0.5 text-xs font-semibold py-2"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
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
