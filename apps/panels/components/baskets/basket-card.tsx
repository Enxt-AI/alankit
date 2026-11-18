'use client';

import { type KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import type { BasketWithConstituents } from '@/types/basket';

interface BasketCardProps {
  basket: BasketWithConstituents;
  onViewDetails: () => void;
  onBuyNow: () => void;
}

export function BasketCard({ basket, onViewDetails, onBuyNow }: BasketCardProps) {
  const isBuyDisabled = basket.resolvedStatus === 'CLOSED' || basket.resolvedStatus === 'DRAFT';

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'default';
      case 'CLOSED':
        return 'destructive';
      case 'COMING_SOON':
        return 'secondary';
      case 'DRAFT':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewDetails();
    }
  };

  return (
    <Card
      className="group relative transition-all duration-200 cursor-pointer"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="article"
      aria-label={`${basket.name} basket`}
    >
      <CardHeader className="p-6">
        {/* Icon */}
        <div className="flex gap-4">
          {basket.iconUrl ? (
            <img
              src={basket.iconUrl}
              alt={`${basket.name} icon`}
              className="h-20 w-20 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="hidden h-20 w-20 items-center justify-center rounded-lg bg-muted">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            {/* Name */}
            <CardTitle className="line-clamp-2 text-2xl">
              {basket.name}
            </CardTitle>
            {/* Badges */}
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-sm rounded-sm">
                {basket.category}
              </Badge>
              <Badge
                variant={getStatusVariant(basket.resolvedStatus) as any}
                className={
                  basket.resolvedStatus === 'OPEN'
                    ? 'bg-green-500 hover:bg-green-600 text-white rounded-sm'
                    : ''
                }
              >
                {basket.resolvedStatus.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Description */}
      {basket.description && (
        <p className="px-6 text-muted-foreground text-base">{basket.description}</p>
      )}

      <CardContent className="p-6">
        <div className="flex justify-between">
          {/* Price */}
          <div className="">
            <p className="text-base font-medium text-muted-foreground">Basket Price</p>
            <p className="text-2xl font-semibold">
              ₹{basket.currentPrice?.toLocaleString('en-IN') || '0'}
            </p>
          </div>
          {/* Constituents Count */}
          <div className="">
            <p className="text-base font-medium text-muted-foreground">Stocks Included</p>
            <p className="text-2xl text-right font-semibold">
              {basket.constituents?.length || 0}
            </p>
          </div>
        </div>
        {/* CTA Buttons */}
        <div
          className="flex gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            View Details
          </Button>
          <Button
            variant="default"
            className="flex-1 bg-green-600 hover:bg-white hover:text-green-600 border-2 hover:border-green-600"
            onClick={(e) => {
              e.stopPropagation();
              onBuyNow();
            }}
            disabled={isBuyDisabled}
            title={
              isBuyDisabled
                ? 'This basket is not available for purchase'
                : 'Buy this basket now'
            }
          >
            Buy Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
