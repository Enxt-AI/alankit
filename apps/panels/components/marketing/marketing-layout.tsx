'use client';

import { useState } from 'react';
import MarketingSidebar from './sidebar';
import MarketingHeader from './header';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const sidebarWidth = isSidebarCollapsed ? "w-[68px]" : "w-[272px]";
  const mainMargin = isSidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[272px]";

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Desktop Sidebar */}
      <aside className={cn("fixed left-0 top-0 hidden h-screen border-r border-neutral-200/30 bg-white lg:block transition-all duration-300 z-30", sidebarWidth)}>
        <MarketingSidebar collapsed={isSidebarCollapsed} />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-[272px] p-0 border-none">
          <MarketingSidebar onLinkClick={() => setIsMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className={cn("flex min-h-screen flex-1 flex-col transition-all duration-300", mainMargin)}>
        <MarketingHeader
          onMenuClick={() => setIsMobileMenuOpen(true)}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className="flex-1 px-8 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
