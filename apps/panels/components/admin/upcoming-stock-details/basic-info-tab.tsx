'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UpcomingStock } from '@/types/stock';
import { UpcomingStockForm } from '@/components/admin/upcoming-stock-form';

interface UpcomingBasicInfoTabProps {
  stock: UpcomingStock;
  onUpdate: () => void;
}

export function UpcomingBasicInfoTab({ stock, onUpdate }: UpcomingBasicInfoTabProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Stock</CardTitle>
        <CardDescription>Manage upcoming stock details shown to users.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Name</div>
            <div className="text-lg font-medium">{stock.name}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">CIN</div>
            <div className="text-lg font-mono">{stock.cin}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Price</div>
            <div className="text-lg font-medium">₹{stock.price.toFixed(2)}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Status</div>
            <div>
              {stock.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
            </div>
          </div>

          <div className="space-y-1 md:col-span-2">
            <div className="text-sm text-muted-foreground">Logo URL</div>
            <div className="text-sm break-all">{stock.logoUrl || '—'}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="text-sm">{new Date(stock.createdAt).toLocaleDateString()}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Updated</div>
            <div className="text-sm">{new Date(stock.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>

        <div>
          <Button onClick={() => setIsEditOpen(true)}>Edit Upcoming Stock</Button>
        </div>

        <UpcomingStockForm
          mode="edit"
          stock={stock}
          isOpen={isEditOpen}
          onCloseAction={() => setIsEditOpen(false)}
          onSuccessAction={() => {
            setIsEditOpen(false);
            onUpdate();
          }}
        />
      </CardContent>
    </Card>
  );
}
