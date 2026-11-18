'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { basicInfoSchema, type BasicInfoFormData } from '@/lib/validations/stock-details-schema';
import { useUpdateStockBasicInfo } from '@/hooks/use-stock-details';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import type { Stock } from '@/types/stock';

interface BasicInfoTabProps {
  stock: Stock;
  onUpdate: () => void;
}

export function BasicInfoTab({ stock, onUpdate }: BasicInfoTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useUpdateStockBasicInfo();
  const { isSuperAdmin } = useCMSAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema as any),
    defaultValues: {
      name: stock.name || '',
      slug: stock.slug || '',
      minimumPurchaseQuantity: stock.minimumPurchaseQuantity || undefined,
      maximumPurchaseQuantity: stock.maximumPurchaseQuantity || undefined,
    },
  });

  // Reset form when stock data changes to prevent stale values
  useEffect(() => {
    reset({
      name: stock.name || '',
      slug: stock.slug || '',
      minimumPurchaseQuantity: stock.minimumPurchaseQuantity ?? undefined,
      maximumPurchaseQuantity: stock.maximumPurchaseQuantity ?? undefined,
    });
  }, [stock.name, stock.slug, stock.minimumPurchaseQuantity, stock.maximumPurchaseQuantity, reset]);

  const onSubmit = async (data: BasicInfoFormData) => {
    try {
      await updateMutation.mutateAsync({
        stockId: stock.id,
        data: {
          name: isSuperAdmin ? data.name : undefined,
          slug: isSuperAdmin ? data.slug : undefined,
          minimumPurchaseQuantity: data.minimumPurchaseQuantity || null,
          maximumPurchaseQuantity: data.maximumPurchaseQuantity || null,
        },
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };



  return (
    <div 
      className="border border-neutral-200/40 rounded-[24px] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.03)] space-y-6"
    >
      <div>
        <h3 className="text-lg font-bold text-[#0F172A]">Basic Information</h3>
        <p className="text-xs font-medium text-[#64748B] mt-1">
          Manage fundamental stock information including stock name, URL slug, and minimum purchase quantity.
        </p>
      </div>

      <div className="space-y-6">
        {/* Current Values Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Stock Name</span>
            <div className="text-lg font-bold text-[#0F172A] truncate" title={stock.name}>
              {stock.name || 'Not set'}
            </div>
            <p className="text-[11px] font-medium text-[#64748B]/80 leading-normal">
              Official name of the stock/company
            </p>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Min. Purchase Qty</span>
            <div className="text-lg font-bold text-[#0F172A]">
              {stock.minimumPurchaseQuantity || '1 (Default)'}
            </div>
            <p className="text-[11px] font-medium text-[#64748B]/80 leading-normal">
              Minimum shares required per order
            </p>
          </div>

          <div className="p-4 bg-[#FAFBFC] border border-neutral-200/30 rounded-[16px] space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Max. Purchase Qty</span>
            <div className="text-lg font-bold text-[#0F172A]">
              {stock.maximumPurchaseQuantity || 'No Limit'}
            </div>
            <p className="text-[11px] font-medium text-[#64748B]/80 leading-normal">
              Maximum shares allowed per order
            </p>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-md bg-[#FAFBFC] p-6 rounded-[20px] border border-neutral-200/40">
            {/* Stock Name (restricted to Super Admin) */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Stock Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter stock name"
                disabled={!isSuperAdmin}
                className="h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 w-full"
                {...register('name')}
              />
              {!isSuperAdmin && (
                <p className="text-[11px] font-medium text-[#64748B]/80 leading-normal">
                  Only Super Admins can edit the stock name.
                </p>
              )}
              {errors.name && (
                <p className="text-xs text-red-500 font-semibold">{errors.name.message}</p>
              )}
            </div>

            {/* URL Slug (restricted to Super Admin) */}
            <div className="space-y-1.5">
              <Label htmlFor="slug" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">URL Slug</Label>
              <Input
                id="slug"
                type="text"
                placeholder="e.g., acme-corporation"
                disabled={!isSuperAdmin}
                className="h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 w-full"
                {...register('slug')}
              />
              {isSuperAdmin && (
                <p className="text-[10px] text-[#64748B] leading-normal">
                  Used in URL: /stocks/your-slug
                </p>
              )}
              {errors.slug && (
                <p className="text-xs text-red-500 font-semibold">{errors.slug.message}</p>
              )}
            </div>



            {/* Minimum Purchase Quantity */}
            <div className="space-y-1.5">
              <Label htmlFor="minimumPurchaseQuantity" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Minimum Purchase Quantity</Label>
              <Input
                id="minimumPurchaseQuantity"
                type="number"
                placeholder="Enter minimum purchase quantity"
                className="h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 w-full"
                {...register('minimumPurchaseQuantity', { valueAsNumber: true })}
              />
              {errors.minimumPurchaseQuantity && (
                <p className="text-xs text-red-500 font-semibold">{errors.minimumPurchaseQuantity.message}</p>
              )}
            </div>

            {/* Maximum Purchase Quantity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="maximumPurchaseQuantity" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Maximum Purchase Quantity</Label>
                {watch('maximumPurchaseQuantity') != null && (
                  <button
                    type="button"
                    onClick={() => setValue('maximumPurchaseQuantity', null, { shouldDirty: true })}
                    className="text-[11px] font-semibold text-[#16A34A] hover:underline"
                  >
                    Clear limit (No limit)
                  </button>
                )}
              </div>
              <Input
                id="maximumPurchaseQuantity"
                type="number"
                placeholder="Enter maximum purchase quantity (leave empty for no limit)"
                className="h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 w-full"
                {...register('maximumPurchaseQuantity', { valueAsNumber: true })}
              />
              <p className="text-[10px] text-[#64748B] leading-normal">
                Leave empty to allow unlimited purchase quantity.
              </p>
              {errors.maximumPurchaseQuantity && (
                <p className="text-xs text-red-500 font-semibold">{errors.maximumPurchaseQuantity.message}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 flex items-center justify-center outline-none"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button 
            onClick={() => setIsEditing(true)}
            className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
          >
            Edit Basic Info
          </Button>
        )}


      </div>
    </div>
  );
}