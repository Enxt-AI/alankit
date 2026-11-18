import Footer from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/navbar";
import { GlobalSEO } from "@/components/seo/GlobalSEO";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export default function LegalPoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <GlobalSEO />
      <Navbar />

      <main className="mt-16 pb-[env(safe-area-inset-bottom)] md:pb-0">
        <Breadcrumbs />
        {children}
      </main>

      <Footer />
    </>
  );
}
