'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSupportAuth } from '@/hooks/use-support-auth';
import { useSupportTicketStats } from '@/hooks/use-support-stats';
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Users,
  X,
  LifeBuoy,
  Sparkles,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navigation = [
  {
    name: 'Dashboard',
    href: '/support/dashboard',
    icon: LayoutDashboard,
    permissions: ['view_tickets', 'update_ticket_status', 'assign_tickets', 'escalate_tickets', 'add_internal_notes'],
  },
  {
    name: 'Tickets',
    href: '/support/tickets',
    icon: Ticket,
    permissions: ['view_tickets', 'update_ticket_status', 'assign_tickets', 'escalate_tickets', 'add_internal_notes'],
    badgeKey: 'openTickets' as const,
  },
  {
    name: 'Reports',
    href: '/support/reports',
    icon: BarChart3,
    permissions: ['view_all_tickets'],
  },
];

interface SupportSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
}

export function SupportSidebar({ isOpen, onClose, collapsed = false }: SupportSidebarProps) {
  const pathname = usePathname();
  const { supportAdmin, hasAnyPermission } = useSupportAuth();
  const { data: stats } = useSupportTicketStats();

  const isActive = (path: string) => pathname === path || (path !== '/support/dashboard' && pathname.startsWith(path));

  const renderNavLinks = (onLinkClick?: () => void, collapsedLink = false) => {
    return (
      <ul className="space-y-1.5">
        {navigation.map((item) => {
          const active = isActive(item.href);
          const hasAccess = hasAnyPermission(item.permissions as any);

          if (!hasAccess) return null;

          const badgeCount = item.badgeKey === 'openTickets' ? stats?.openTickets : null;

          const linkContent = (
            <Link
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "group/nav relative flex items-center transition-all duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2",
                collapsedLink 
                  ? "justify-center p-2.5 rounded-xl mx-auto" 
                  : "gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold",
                active
                  ? "bg-[#16A34A] text-white shadow-[0_4px_16px_rgba(22,163,74,0.25)] font-bold"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-neutral-100/80 active:scale-[0.98]"
              )}
            >
              <item.icon
                className={cn(
                  "transition-all duration-200 shrink-0",
                  collapsedLink ? "h-5 w-5" : "h-[18px] w-[18px]",
                  active ? "text-white" : "text-[#64748B] group-hover/nav:text-[#16A34A]"
                )}
                aria-hidden="true"
              />
              {!collapsedLink && (
                <div className="flex flex-1 items-center justify-between">
                  <span>{item.name}</span>
                  {badgeCount !== null && badgeCount !== undefined && badgeCount > 0 && (
                    <span
                      className={cn(
                        "ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded-full transition-colors leading-none tracking-tight",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20"
                      )}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );

          return (
            <li key={item.name}>
              {collapsedLink ? (
                <Tooltip>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold text-xs py-1 px-2.5">
                    {item.name}
                    {badgeCount ? ` (${badgeCount})` : ''}
                  </TooltipContent>
                </Tooltip>
              ) : (
                linkContent
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const renderUserSection = (collapsedUser = false) => {
    const isSuperAdmin = supportAdmin?.role === 'SUPER_ADMIN';
    const availability = (supportAdmin as any)?.availability || 'available';

    const getStatusColor = () => {
      switch (availability) {
        case 'available':
          return 'bg-emerald-500 ring-emerald-400/30';
        case 'busy':
          return 'bg-amber-500 ring-amber-400/30';
        case 'unavailable':
          return 'bg-rose-500 ring-rose-400/30';
        default:
          return 'bg-emerald-500 ring-emerald-400/30';
      }
    };

    return (
      <div className={cn("p-3 border-t border-neutral-200/50 bg-neutral-50/50", collapsedUser ? "p-2" : "")}>
        {collapsedUser ? (
          <div className="flex justify-center">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-neutral-200/60 shadow-xs" title={supportAdmin?.fullName || 'Agent'}>
              <span className="text-xs font-bold text-[#0F172A]">
                {(supportAdmin?.fullName || 'S').charAt(0).toUpperCase()}
              </span>
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", getStatusColor())} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl p-2.5 bg-white border border-neutral-200/60 shadow-xs">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECFDF5] border border-[#16A34A]/20 shrink-0">
              <span className="text-xs font-bold text-[#16A34A]">
                {(supportAdmin?.fullName || 'S').charAt(0).toUpperCase()}
              </span>
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", getStatusColor())} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-[#0F172A] truncate">
                  {supportAdmin?.fullName || 'Support Agent'}
                </p>
                {isSuperAdmin && (
                  <span className="text-[9px] font-black uppercase px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded tracking-tight shrink-0">
                    SA
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium text-[#64748B] truncate">
                {supportAdmin?.email}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <div className={cn("hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300", collapsed ? "lg:w-[68px]" : "lg:w-64")}>
        <nav
          aria-label="Support navigation"
          className="flex h-screen flex-col bg-white border-r border-neutral-200/60 shadow-[2px_0_12px_rgba(15,23,42,0.02)] transition-all duration-300"
        >
          {/* Brand Header */}
          <div className={cn("h-16 flex items-center border-b border-neutral-200/50 transition-all duration-300", collapsed ? "px-3 justify-center" : "px-6 justify-between")}>
            <Link href="/support/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#16A34A] to-[#15803D] flex items-center justify-center text-white shadow-sm shadow-[#16A34A]/30 group-hover:scale-105 transition-transform">
                <LifeBuoy className="h-4 w-4" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-extrabold tracking-tight text-[#0F172A]">SMC Desk</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">v2</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#64748B] -mt-0.5">Support Center</span>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Section */}
          <div className={cn("flex-1 overflow-y-auto py-4 transition-all duration-300", collapsed ? "px-2" : "px-3.5")}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Operations</p>
            )}
            {renderNavLinks(undefined, collapsed)}
          </div>

          {/* User Card */}
          {renderUserSection(collapsed)}
        </nav>
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform bg-white border-r border-neutral-200/60 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-neutral-200/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#16A34A] to-[#15803D] flex items-center justify-center text-white shadow-sm">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-extrabold tracking-tight text-[#0F172A]">SMC Desk</span>
              <span className="text-[10px] font-semibold text-[#64748B] -mt-0.5">Support Center</span>
            </div>
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-neutral-100"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3.5 py-4">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Operations</p>
          {renderNavLinks(onClose)}
        </div>
        {renderUserSection()}
      </div>
    </TooltipProvider>
  );
}