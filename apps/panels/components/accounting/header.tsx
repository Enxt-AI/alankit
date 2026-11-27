"use client";

import { useState } from "react";

import {
  Bell,
  Menu,
  Search,
  User,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
} from "lucide-react";
import { useAccountingAdmin } from "@/store/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ActiveSessionsDialog from "@/components/shared/active-sessions-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";

interface AccountingHeaderProps {
  onMenuClick: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AccountingHeader({
  onMenuClick,
  collapsed,
  onToggleCollapse,
}: AccountingHeaderProps) {
  const { accountingAdmin } = useAccountingAdmin();
  const logout = useAuthStore((state) => state.accountingLogout);
  const router = useRouter();
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/accounting/login");
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
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
          <h1 className="text-[14px] font-extrabold tracking-tight text-[#0F172A]">
            <span className="text-[#16A34A]"></span> Accounting Panel
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="hidden flex-col items-start lg:flex">
                  <span className="text-sm font-medium">
                    {accountingAdmin?.fullName || "Accountant"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Accounting
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setSessionsOpen(true)}>
                <Shield className="mr-2 h-4 w-4" />
                Active Sessions
              </DropdownMenuItem>

              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
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
