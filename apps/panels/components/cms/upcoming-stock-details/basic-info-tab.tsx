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
    <div 
      className="border border-neutral-200/40 rounded-[24px] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.03)] space-y-6"
    >
      <div>
        <h3 className="text-lg font-bold text-[#0F172A]">Upcoming Stock</h3>
        <p className="text-xs font-medium text-[#64748B] mt-1">Manage upcoming stock details shown to users.</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Name</span>
            <div className="text-lg font-bold text-[#0F172A]">{stock.name}</div>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">CIN</span>
            <div className="text-lg font-mono font-bold text-[#0F172A]">{stock.cin}</div>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Price</span>
            <div className="text-lg font-bold text-[#0F172A]">₹{stock.price.toFixed(2)}</div>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Status</span>
            <div className="pt-0.5">
              {stock.isActive ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20">Active</span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-neutral-50 text-[#64748B] border-neutral-200/60">Inactive</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1 md:col-span-2">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Logo URL</span>
            <div className="text-sm font-medium text-[#0F172A] break-all">{stock.logoUrl || '—'}</div>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Created</span>
            <div className="text-sm font-semibold text-[#64748B]">{new Date(stock.createdAt).toLocaleDateString()}</div>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Updated</span>
            <div className="text-sm font-semibold text-[#64748B]">{new Date(stock.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>

        <div>
          <Button 
            onClick={() => setIsEditOpen(true)}
            className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
          >
            Edit Upcoming Stock
          </Button>
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
          useCmsEndpoint={true}
        />
      </div>
    </div>
  );
}
