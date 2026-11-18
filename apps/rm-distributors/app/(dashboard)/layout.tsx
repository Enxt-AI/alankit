import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex bg-gray-50 min-h-screen w-full">
        <Sidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 bg-transparent">
          <Header />
          <main className="p-6 md:p-8 flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
