import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StatusPageView } from "@/components/ui/status-feedback";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />
      <StatusPageView
        code="404"
        title="We couldn't find that page"
        description="The page or stock link you're looking for may have been moved, renamed, or doesn't exist."
        suggestion="Check the URL or use one of the shortcuts below to get back on track."
      />
      <Footer />
    </div>
  );
}

