'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { Stock } from '@/types/stock';

interface BasicInfoTabProps {
  stock: Stock;
  onUpdate: () => void;
}

export function BasicInfoTab({ stock }: BasicInfoTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          Fundamental stock information is managed in the CMS panel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Stock Name</Label>
            <div className="text-xl font-bold">
              {stock.name || 'Not set'}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Min. Purchase Qty</Label>
            <div className="text-xl font-bold">
              {stock.minimumPurchaseQuantity || '1 (Default)'}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Max. Purchase Qty</Label>
            <div className="text-xl font-bold">
              {stock.maximumPurchaseQuantity || 'No Limit'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}