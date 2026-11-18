"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, TrendingUp } from "lucide-react";

interface EmptyPortfolioProps {
  onExploreStocks: () => void;
}

export function EmptyPortfolio({ onExploreStocks }: EmptyPortfolioProps) {
  return (
    <div className="flex justify-center">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-16 pb-16">
          <div className="flex flex-col items-center space-y-6 text-center">
            {/* Icon */}
            <Briefcase
              className="h-16 w-16 text-muted-foreground"
              aria-hidden="true"
            />

            {/* Heading */}
            <h2 className="text-2xl font-bold">No holdings yet</h2>

            {/* Description */}
            <p className="text-muted-foreground text-base max-w-md">
              You haven't invested in any stocks yet. Start exploring unlisted
              stocks and build your portfolio.
            </p>

            {/* CTA Button */}
            <Button size="lg" onClick={onExploreStocks}>
              <TrendingUp className="mr-2 h-5 w-5" />
              Explore Stocks
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
