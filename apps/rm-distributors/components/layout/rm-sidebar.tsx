"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, Users, ShieldAlert, LogOut, TrendingUp, User } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function RmSidebar() {
  const pathname = usePathname();

  const routes = [
    { href: "/rm", label: "Dashboard", icon: Users, active: pathname === "/rm" },
    { href: "/rm/coupons", label: "Referral Codes", icon: Ticket, active: pathname === "/rm/coupons" },
    { href: "/rm/sales", label: "Sales", icon: TrendingUp, active: pathname === "/rm/sales" }
  ];

  return (
    <ShadcnSidebar collapsible="icon" className="border-r border-neutral-200/30">
      <SidebarHeader>
        <div className="flex items-center justify-center pt-6 pb-5 w-full group-data-[collapsible=icon]:px-0">
          <ShieldAlert className="h-5 w-5 text-[#16A34A] mr-2 group-data-[collapsible=icon]:hidden shrink-0" />
          <h1 className="text-[20px] font-extrabold tracking-tight leading-none text-[#0F172A] whitespace-nowrap group-data-[collapsible=icon]:hidden overflow-hidden">
            <span className="text-[#16A34A]">RM</span> Portal
          </h1>
          <span className="text-[18px] font-black text-[#16A34A] tracking-tight hidden group-data-[collapsible=icon]:block text-center w-full">RM</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]/60 mb-2 group-data-[collapsible=icon]:hidden">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {routes.map((route) => {
                const Icon = route.icon;
                return (
                  <SidebarMenuItem key={route.href}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={route.active} 
                      className={cn(
                        "group/nav flex items-center transition-all duration-300 ease-in-out font-semibold",
                        "group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!w-12 group-data-[collapsible=icon]:!h-12 group-data-[collapsible=icon]:!rounded-xl group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!items-center group-data-[collapsible=icon]:mx-auto",
                        "group-data-[collapsible=none]:gap-3 group-data-[collapsible=none]:rounded-full group-data-[collapsible=none]:px-4 group-data-[collapsible=none]:py-5 group-data-[collapsible=none]:text-[14px]",
                        route.active 
                          ? "!bg-[#DCFCE7]/70 !text-[#16A34A] hover:!bg-[#DCFCE7]/90" 
                          : "text-[#64748B] bg-transparent hover:!bg-[#ECFDF5] hover:!text-[#0F172A]"
                      )}
                    >
                      <Link href={route.href}>
                        <Icon 
                          className={cn(
                            "transition-colors duration-300 ease-in-out shrink-0 size-5",
                            "group-data-[collapsible=icon]:mx-auto",
                            route.active ? "text-[#16A34A]" : "text-[#64748B]/70 group-hover/nav:text-[#16A34A]"
                          )} 
                        />
                        <span className="group-data-[collapsible=icon]:hidden">{route.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </ShadcnSidebar>
  );
}
