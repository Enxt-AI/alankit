import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { TrendingStocks } from "@/components/trending-stocks";
import { HighestVolumeStocks } from "@/components/highest-volume-stocks";
import { StrongestWeakestStocks } from "@/components/strongest-weakest-stocks";
import { CommonStocks } from "@/components/common-stocks";
import { FeaturesSection } from "@/components/features-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrendingStocks />
        <HighestVolumeStocks />
        <StrongestWeakestStocks />
        <CommonStocks />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
}
