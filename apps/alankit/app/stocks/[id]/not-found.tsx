import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StatusPageView } from "@/components/ui/status-feedback";

export default function StockNotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />
      <StatusPageView
        code="404"
        title="Stock symbol not found"
        description="We couldn't locate market data for that stock ticker symbol in our directory."
        suggestion="Please verify the ticker symbol or select one of our actively tracked stocks below."
      />
      <Footer />
    </div>
  );
}

