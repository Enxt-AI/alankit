import { Navbar } from "@/components/layout/navbar";
import Sidebar from "@/components/layout/Sidebar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { UserAuthGuard } from "@/components/auth/user-auth-guard";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <Navbar />
      <Sidebar />

      <main className="flex-1 md:pl-[240px] pt-16 pb-[calc(2.5rem_+_env(safe-area-inset-bottom))] md:pb-10 transition-all duration-300">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 w-full h-full pt-2 sm:pt-2.5 space-y-4">
          <Breadcrumbs containerClassName="px-0 pt-0 pb-1" />
          <UserAuthGuard>{children}</UserAuthGuard>
        </div>
      </main>
    </div>
  );
}
