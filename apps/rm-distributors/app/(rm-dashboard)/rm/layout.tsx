import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { RmSidebar } from "@/components/layout/rm-sidebar";
import { Header } from "@/components/layout/header";
 
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50 flex w-full">
        <RmSidebar />
        
        <SidebarInset className="flex-1 flex flex-col min-w-0 bg-transparent">
          <Header />
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
