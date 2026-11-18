"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, TrendingUp } from "lucide-react";

interface EmptyPortfolioProps {
  onExploreStocks?: () => void;
}

export function EmptyPortfolio({ onExploreStocks }: EmptyPortfolioProps) {
  return (
    <div className="flex justify-center w-full py-4">
      <Card className="max-w-2xl w-full rounded-[32px] border border-slate-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05),0_20px_40px_rgba(15,23,42,0.04)] overflow-hidden">
        <CardContent className="pt-16 pb-16 px-6 sm:px-10">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon Section - Circular elevated container with soft green-tinted background */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-600 shadow-[0_4px_12px_rgba(22,163,74,0.08)]">
              <Briefcase className="h-7 w-7" aria-hidden="true" />
            </div>

            {/* Typography Section */}
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                No holdings yet
              </h2>
              <p className="text-slate-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                You haven't invested in any stocks yet. Start exploring unlisted
                stocks and build your portfolio.
              </p>
            </div>

            {/* CTA Button - Premium brand green with hover lift */}
            <Button
              asChild
              size="lg"
              className="rounded-xl px-5 h-11 text-sm font-semibold bg-green-600 text-white hover:bg-green-700 shadow-[0_4px_12px_rgba(22,163,74,0.15)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(22,163,74,0.25)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(22,163,74,0.15)] transition-all duration-300 gap-2 shrink-0 border-none animate-none"
            >
              <Link href="/stocks">
                <TrendingUp className="h-4 w-4" />
                Explore Stocks
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

