"use client";

import { BasketWithConstituents } from "@/types/basket";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBasket } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Basket Teaser Card Component
 * Displays a preview card for a basket in teaser sections
 * 
 * @param basket - The basket data to display
 * @param onClick - Handler for card click
 */
interface BasketTeaserCardProps {
  basket: BasketWithConstituents;
  onClick: () => void;
}

export function BasketTeaserCard({ basket, onClick }: BasketTeaserCardProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'default';
      case 'CLOSED':
        return 'secondary';
      case 'COMING_SOON':
        return 'outline';
      case 'DRAFT':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // Get status display text
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'COMING_SOON':
        return 'Coming Soon';
      default:
        return status.charAt(0) + status.slice(1).toLowerCase();
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
        "border-2 hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6 space-y-4">
        {/* Icon Section */}
        <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 mx-auto">
          {basket.iconUrl ? (
            <img
              src={basket.iconUrl}
              alt={`${basket.name} icon`}
              className="h-12 w-12 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : (
            <ShoppingBasket className="h-8 w-8 text-primary" />
          )}
          <div className="hidden flex h-12 w-12 items-center justify-center">
            <ShoppingBasket className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-center line-clamp-2 min-h-[3.5rem]">
          {basket.name}
        </h3>

        {/* Category Badge */}
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-xs">
            {basket.category}
          </Badge>
        </div>

        {/* Price */}
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(basket.currentPrice)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Current Price
          </p>
        </div>

        {/* Constituents Count */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShoppingBasket className="h-4 w-4" />
          <span>{basket.constituents.length} Stocks</span>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center pt-2">
          <Badge variant={getStatusVariant(basket.resolvedStatus)}>
            {getStatusDisplay(basket.resolvedStatus)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
