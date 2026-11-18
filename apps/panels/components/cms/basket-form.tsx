'use client';

import { useEffect, useState } from 'react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { VersionHistoryDialog } from '@/components/admin/version-history-dialog';
import { RollbackConfirmationDialog } from '@/components/admin/rollback-confirmation-dialog';
import {
  useCreateAdminBasket,
  useUpdateAdminBasket,
} from '@/hooks/use-admin-baskets';
import { useCreateCMSBasket, useUpdateCMSBasket } from '@/hooks/use-cms-baskets';
import { useAdminStocks } from '@/hooks/use-admin-stocks';
import { useRollbackVersion } from '@/hooks/use-versions';
import { createBasketSchema, updateBasketSchema } from '@/lib/validations/basket-schema';
import type { CreateBasketFormValues, UpdateBasketFormValues } from '@/lib/validations/basket-schema';
import type { BasketWithConstituents, CreateBasketDto, UpdateBasketDto } from '@/types/basket';
import { BasketStatus } from '@/types/basket';
import { notify } from '@/components/ui/floating-notification';
import { Loader2, Plus, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageUpload } from '@/components/ui/image-upload';
import { cn } from '@/lib/utils';

interface BasketFormProps {
  mode: 'create' | 'edit';
  basket?: BasketWithConstituents;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
}

interface ConstituentItem {
  stockId: string;
  weight: number;
  quantity?: number;
}

const BASKET_CATEGORIES = [
  'High Growth',
  'Balanced',
  'Value',
  'Dividend',
  'Tech Focus',
  'ESG',
  'Blue Chip',
  'Small Cap',
  'International',
  'Sector Specific',
];

export function BasketForm({
  mode,
  basket,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint = true,
}: BasketFormProps) {
  const [constituents, setConstituents] = useState<ConstituentItem[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [totalWeight, setTotalWeight] = useState(0);
  const [basketPrice, setBasketPrice] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [rollbackVersion, setRollbackVersion] = React.useState<number | null>(null);

  const rollbackMutation = useRollbackVersion(useCmsEndpoint);
  const createCmsBasket = useCreateCMSBasket();
  const updateCmsBasket = useUpdateCMSBasket();
  const createAdminBasket = useCreateAdminBasket();
  const updateAdminBasket = useUpdateAdminBasket();

  const createBasket = useCmsEndpoint ? createCmsBasket : createAdminBasket;
  const updateBasket = useCmsEndpoint ? updateCmsBasket : updateAdminBasket;

  const { data: stocks = [], isLoading: stocksLoading } = useAdminStocks(true, useCmsEndpoint);

  const form = useForm<CreateBasketFormValues | UpdateBasketFormValues>({
    resolver: zodResolver((mode === 'create' ? createBasketSchema : updateBasketSchema) as any),
    defaultValues: {
      name: '',
      category: '',
      minInvestment: 0,
      constituents: [],
      description: '',
      iconUrl: '',
      status: BasketStatus.DRAFT,
      subscriptionStartDate: '',
      subscriptionEndDate: '',
      priceEffectiveDate: new Date().toISOString().split('T')[0],
      isActive: true,
    },
  });

  // Sync constituents into RHF only when they actually change (avoids render loop / React #185)
  useEffect(() => {
    const current = form.getValues('constituents' as any) as unknown;
    if (JSON.stringify(current) !== JSON.stringify(constituents.map(({ stockId, weight }) => ({ stockId, weight })))) {
      form.setValue(
        'constituents' as any,
        constituents.map(({ stockId, weight }) => ({ stockId, weight })) as any,
        { shouldValidate: true, shouldDirty: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constituents]);

  useEffect(() => {
    const total = constituents.reduce((sum, c) => sum + c.weight, 0);
    setTotalWeight((prev) => (Math.abs(prev - total) < 1e-9 ? prev : total));

    let price = 0;
    constituents.forEach((constituent) => {
      const stock = stocks.find((s) => s.id === constituent.stockId);
      if (stock) {
        price += (stock.price || 0) * (constituent.quantity || 0);
      }
    });
    price = Math.round(price * 100) / 100;
    setBasketPrice((prev) => (prev === price ? prev : price));

    // Automatically set minInvestment based on the calculated price (guarded to avoid loop)
    const currentMin = Number(form.getValues('minInvestment' as any) ?? NaN);
    if (price >= 0 && currentMin !== price) {
      form.setValue('minInvestment' as any, price as any, { shouldValidate: false, shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constituents, stocks]);

  // Initialise edit form once per open (not on every stocks refetch, which would wipe user edits)
  const editInitKey = React.useRef<string | null>(null);
  useEffect(() => {
    if (mode === 'edit' && basket && isOpen) {
      const key = `${basket.id}`;
      if (editInitKey.current !== key) {
        editInitKey.current = key;
        form.reset({
          name: basket.name,
          category: basket.category,
          minInvestment: basket.minInvestment,
          description: basket.description || '',
          iconUrl: basket.iconUrl || '',
          status: basket.status,
          subscriptionStartDate: basket.subscriptionStartDate
            ? new Date(basket.subscriptionStartDate).toISOString().split('T')[0]
            : '',
          subscriptionEndDate: basket.subscriptionEndDate
            ? new Date(basket.subscriptionEndDate).toISOString().split('T')[0]
            : '',
          priceEffectiveDate: basket.priceEffectiveDate
            ? new Date(basket.priceEffectiveDate).toISOString().split('T')[0]
            : '',
          isActive: basket.isActive,
          constituents: [],
        });
      }

      // (Re)derive quantities whenever stock prices arrive, but don't wipe user edits afterwards
      if (basket.constituents && stocks.length > 0) {
        setConstituents((prev) => {
          if (prev.length > 0) return prev;
          return basket.constituents!.map((c) => {
            const stock = stocks.find(s => s.id === c.stockId);
            let estimatedQuantity = 0;
            if (stock && stock.price && basket.minInvestment) {
               const targetValue = (c.weight / 100) * basket.minInvestment;
               estimatedQuantity = Math.round(targetValue / stock.price);
            }
            return {
              stockId: c.stockId,
              weight: c.weight,
              quantity: estimatedQuantity,
            };
          });
        });
      }
    }
    if (!isOpen) editInitKey.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, basket, isOpen, stocks]);

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setConstituents([]);
      setSelectedStockId('');
      setTotalWeight(0);
      setBasketPrice(0);
    }
  }, [isOpen, form]);

  const recalculateConstituents = (list: ConstituentItem[]) => {
    let totalValue = 0;
    list.forEach((c) => {
      const stock = stocks.find((s) => s.id === c.stockId);
      if (stock) {
        totalValue += (stock.price || 0) * (c.quantity || 0);
      }
    });

    if (totalValue <= 0 || list.length === 0) {
      return list.map((c) => ({ ...c, weight: 0 }));
    }

    // Round all but the largest holding; assign the remainder to it so the sum is exactly 100.
    const raw = list.map((c) => {
      const stock = stocks.find((s) => s.id === c.stockId);
      const value = (stock?.price || 0) * (c.quantity || 0);
      return { item: c, value, exact: (value / totalValue) * 100 };
    });
    let largestIdx = 0;
    raw.forEach((r, i) => {
      if (r.value > raw[largestIdx]!.value) largestIdx = i;
    });

    let running = 0;
    return raw.map((r, i) => {
      if (i === largestIdx) return r.item; // filled below
      const rounded = Math.round(r.exact * 100) / 100;
      running += rounded;
      return { ...r.item, weight: rounded };
    }).map((c, i) => {
      if (i !== largestIdx) return c;
      const remainder = Math.round((100 - running) * 100) / 100;
      return { ...c, weight: remainder >= 0 ? remainder : 0 };
    });
  };

  const addStock = () => {
    if (!selectedStockId) return;
    if (constituents.some((c) => c.stockId === selectedStockId)) {
      notify.error('Stock already added to basket');
      return;
    }
    const defaultQty = 1;
    const updated = [...constituents, { stockId: selectedStockId, weight: 0, quantity: defaultQty }];
    setConstituents(recalculateConstituents(updated));
    setSelectedStockId('');
  };

  const removeStock = (stockId: string) => {
    const updated = constituents.filter((c) => c.stockId !== stockId);
    setConstituents(recalculateConstituents(updated));
  };

  const updateQuantity = (stockId: string, quantity: number) => {
    const newConstituents = constituents.map((c) => (c.stockId === stockId ? { ...c, quantity } : c));
    setConstituents(recalculateConstituents(newConstituents));
  };

  const onSubmit = async (values: CreateBasketFormValues | UpdateBasketFormValues) => {
    try {
      // Backend uses whitelist + forbidNonWhitelisted: send ONLY DTO fields.
      // `constituents` state carries a UI-only `quantity` field which causes 400 if sent.
      const cleanConstituents = constituents.map(({ stockId, weight }) => ({
        stockId,
        weight: Math.round(Number(weight) * 100) / 100,
      }));
      const emptyToUndefined = (v: unknown) =>
        typeof v === 'string' && v.trim() === '' ? undefined : (v as any);
      const toISO = (v: unknown) => {
        if (typeof v !== 'string' || v.trim() === '') return undefined;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
      };
      const payload = {
        ...values,
        description: emptyToUndefined((values as any).description),
        iconUrl: emptyToUndefined((values as any).iconUrl),
        category: typeof (values as any).category === 'string' ? (values as any).category.trim() : (values as any).category,
        name: typeof (values as any).name === 'string' ? (values as any).name.trim() : (values as any).name,
        minInvestment: Math.round(Number((values as any).minInvestment ?? 0) * 100) / 100,
        constituents: cleanConstituents,
        subscriptionStartDate: toISO((values as any).subscriptionStartDate),
        subscriptionEndDate: toISO((values as any).subscriptionEndDate),
        priceEffectiveDate: toISO((values as any).priceEffectiveDate),
      };

      if (mode === 'create') {
        const result: any = await createBasket.mutateAsync(payload as CreateBasketDto);
        notify.success(result?.message || 'Basket creation submitted for admin approval. It will go live after approval.');
      } else if (mode === 'edit' && basket) {
        const result: any = await updateBasket.mutateAsync({ id: basket.id, dto: payload as UpdateBasketDto });
        notify.success(result?.message || 'Basket update submitted for admin approval. It will go live after approval.');
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      notify.error(error.message || `Failed to ${mode} basket`);
    }
  };

  // Only active stocks can be added as constituents. The admin list includes
  // inactive ones, so filter them out — otherwise a deactivated stock stays
  // selectable in the Constituent Allocation dropdown.
  const availableStocks = stocks.filter(
    (stock) => stock.isActive !== false && !constituents.some((c) => c.stockId === stock.id)
  );

  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;
  const hasMinimumStocks = constituents.length >= 2;
  const hasInactiveConstituent = constituents.some((c) => {
    const s = stocks.find((st) => st.id === c.stockId);
    return s?.isActive === false;
  });
  const canSubmit = isWeightValid && hasMinimumStocks && !hasInactiveConstituent;
  const isLoading = createBasket.isPending || updateBasket.isPending || stocksLoading;

  const inputClass = "h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 shadow-sm";
  const textareaClass = "border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 resize-none shadow-sm min-h-[100px]";
  const selectTriggerClass = "h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus:ring-offset-0 focus-visible:ring-0 focus-visible:border-[#16A34A] rounded-[14px] transition-all duration-300 bg-white text-gray-900 shadow-sm";
  const dateInputClass = "h-10 text-sm border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 outline-none transition-all duration-300";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden gap-0 bg-white rounded-3xl border border-neutral-200 shadow-2xl">
          <DialogHeader className="px-6 py-6 border-b border-neutral-100 bg-[#FAFBFC]">
            <DialogTitle className="text-xl font-bold text-[#0F172A]">
              {mode === 'create' ? 'Create New Basket' : 'Edit Basket Details'}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-[#64748B]">
              {mode === 'create'
                ? 'Create a new curated stock basket with precise constituent allocation.'
                : 'Update basket details and re-balance its constituent allocations.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh] overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-[#16A34A] rounded-full"></div>
                    Basic Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Basket Name */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel className="font-semibold text-[#0F172A] text-sm">Basket Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input className={inputClass} placeholder="e.g., High Dividend Yields" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Category */}
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-[#0F172A] text-sm">Category <span className="text-red-500">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={selectTriggerClass}>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl border border-neutral-200 bg-white">
                              {BASKET_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat} className="hover:bg-[#F8FAFC]">
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel className="font-semibold text-[#0F172A] text-sm">Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Detailed basket description explaining its investment thesis"
                              className={textareaClass}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                </div>

                {/* Configuration Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-[#16A34A] rounded-full"></div>
                    Configuration & Dates
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-[#FAFBFC] rounded-[20px] border border-neutral-200/40 shadow-sm">
                    {/* Status */}
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-[#0F172A] text-sm">Basket Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 border-neutral-200 shadow-sm focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 outline-none transition-all duration-300">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl border border-neutral-200 bg-white">
                              <SelectItem value={BasketStatus.DRAFT}>Draft</SelectItem>
                              <SelectItem value={BasketStatus.OPEN}>Open</SelectItem>
                              <SelectItem value={BasketStatus.CLOSED}>Closed</SelectItem>
                              <SelectItem value={BasketStatus.COMING_SOON}>Coming Soon</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Active Status Toggle */}
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-[#16A34A]/40 hover:shadow-md cursor-pointer group" onClick={() => field.onChange(!field.value)}>
                          <div className="space-y-1">
                            <FormLabel className="font-semibold text-sm text-[#0F172A] cursor-pointer pointer-events-none">Active Visibility</FormLabel>
                            <p className="text-[11px] text-[#64748B] leading-tight">Controls if this basket appears in public listings.</p>
                          </div>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-[#16A34A] data-[state=checked]:border-[#16A34A] scale-110" onClick={(e) => e.stopPropagation()} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-200/40">
                      <FormField
                        control={form.control}
                        name="subscriptionStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-[#0F172A] text-xs">Subscription Start</FormLabel>
                            <FormControl>
                              <DatePicker className={dateInputClass} value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="subscriptionEndDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-[#0F172A] text-xs">Subscription End</FormLabel>
                            <FormControl>
                              <DatePicker className={dateInputClass} value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="priceEffectiveDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold text-[#0F172A] text-xs">Price Effective Date</FormLabel>
                            <FormControl>
                              <DatePicker className={dateInputClass} value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Constituents Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-[#16A34A] rounded-full"></div>
                    Constituent Allocation
                  </h3>
                  
                  <div className="rounded-[20px] border border-neutral-200/40 shadow-sm overflow-hidden bg-white">
                    {/* Add Stock Header */}
                    <div className="p-4 border-b border-neutral-100 bg-[#FAFBFC] flex gap-3 sm:flex-row flex-col">
                      <Select value={selectedStockId} onValueChange={setSelectedStockId}>
                        <SelectTrigger className="flex-1 bg-white border-neutral-200 rounded-xl h-10">
                          <SelectValue placeholder="Search and select a stock to add..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-neutral-200 bg-white">
                          {stocksLoading ? (
                            <SelectItem value="loading" disabled>
                              Loading available stocks...
                            </SelectItem>
                          ) : availableStocks.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No more stocks available to add
                            </SelectItem>
                          ) : (
                            availableStocks.map((stock) => (
                              <SelectItem key={stock.id} value={stock.id} className="hover:bg-[#F8FAFC]">
                                <div className="flex items-center justify-between w-full gap-4">
                                  <span>{stock.name} <span className="text-slate-400 font-mono text-xs ml-1">({stock.cin})</span></span>
                                  <span className="font-mono text-xs font-semibold text-emerald-600">₹{(stock.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={addStock}
                        disabled={!selectedStockId}
                        className="h-10 bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow active:scale-[0.98] rounded-xl font-semibold text-sm px-4 transition-all duration-300 flex items-center gap-2 outline-none"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Stock
                      </Button>
                    </div>

                    {/* Constituents List */}
                    {constituents.length > 0 ? (
                      <div className="divide-y divide-neutral-100">
                        {/* Table Header */}
                        <div className="grid grid-cols-[1.5fr_100px_90px_110px_85px_40px] gap-3 bg-[#FAFBFC] p-3 px-5 text-[11px] font-bold tracking-wider text-[#64748B] uppercase border-b border-neutral-100 items-center">
                          <div>Stock Asset</div>
                          <div className="text-right">Price / Share</div>
                          <div className="text-center">Quantity</div>
                          <div className="text-right">Total (₹)</div>
                          <div className="text-center">Weight (%)</div>
                          <div className="text-right">Action</div>
                        </div>

                        {/* List Items */}
                        <div className="max-h-[300px] overflow-y-auto divide-y divide-neutral-100">
                          {constituents.map((constituent) => {
                            const stock = stocks.find((s) => s.id === constituent.stockId);
                            const unitPrice = stock?.price || 0;
                            const qty = constituent.quantity || 0;
                            const itemTotal = unitPrice * qty;

                            return (
                              <div
                                key={constituent.stockId}
                                className="grid grid-cols-[1.5fr_100px_90px_110px_85px_40px] gap-3 items-center p-3 px-5 hover:bg-[#F8FAFC] transition-colors"
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="font-semibold text-[#0F172A] text-sm leading-tight truncate" title={stock?.name}>
                                    {stock?.name || 'Unknown Asset'}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                                    {stock?.cin || 'N/A'}
                                  </span>
                                  {stock && stock.isActive === false && (
                                    <span className="mt-1 inline-flex w-fit items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-red-50 text-red-700 border-red-200/60">
                                      Inactive — remove to proceed
                                    </span>
                                  )}
                                </div>
                                <div className="text-right font-mono text-xs font-semibold text-slate-700">
                                  ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="flex justify-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={constituent.quantity ?? ''}
                                    onChange={(e) =>
                                      updateQuantity(constituent.stockId, parseFloat(e.target.value) || 0)
                                    }
                                    className="h-9 w-full text-center font-semibold shadow-none border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-xl bg-white font-mono text-sm outline-none transition-all duration-300"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="text-right font-mono text-xs font-bold text-slate-900 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 flex flex-col justify-center">
                                  <span>₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex items-center justify-center h-9 px-2 font-semibold shadow-none border border-transparent rounded-xl bg-neutral-50 font-mono text-xs text-slate-600 w-full cursor-not-allowed">
                                  {constituent.weight.toFixed(2)}%
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeStock(constituent.stockId)}
                                    className="h-8 w-8 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Weight Summary Footer */}
                        <div className="bg-[#0F172A] text-white p-5 flex items-center justify-between border-t border-neutral-800">
                          <div>
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Total Weight Allocation</p>
                            <div className="flex items-center gap-3">
                              <p
                                className={cn(
                                  "text-2xl font-bold font-mono tracking-tight",
                                  isWeightValid ? 'text-[#16A34A]' : 'text-red-400'
                                )}
                              >
                                {totalWeight.toFixed(2)}%
                              </p>
                              {!isWeightValid && constituents.length > 0 && (
                                <span className="text-[11px] bg-red-500/20 text-red-200 px-2.5 py-1 rounded-full border border-red-500/30 font-bold">
                                  Must equal 100%
                                </span>
                              )}
                              {!hasMinimumStocks && (
                                <span className="text-[11px] bg-red-500/20 text-red-200 px-2.5 py-1 rounded-full border border-red-500/30 font-bold">
                                  Min 2 stocks required
                                </span>
                              )}
                              {isWeightValid && hasMinimumStocks && (
                                <span className="text-[11px] bg-[#16A34A]/20 text-[#16A34A] px-2.5 py-1 rounded-full border border-[#16A34A]/30 font-bold">
                                  100% Allocated
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Estimated Basket Price</p>
                            <p className="text-2xl font-bold tracking-tight text-white font-mono">₹{basketPrice.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center border-t border-neutral-100">
                        <div className="h-12 w-12 rounded-full bg-neutral-50 flex items-center justify-center mb-3">
                          <AlertCircle className="h-5 w-5 text-[#64748B]" />
                        </div>
                        <h4 className="text-sm font-semibold text-[#0F172A]">No Constituents Added</h4>
                        <p className="text-xs text-[#64748B] max-w-sm mt-1">
                          Select and add stocks from the dropdown above to define the allocation of this basket. Weights are automatically calculated based on quantity.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Action Footer */}
              <DialogFooter className="px-6 py-4 border-t border-neutral-100 bg-[#FAFBFC] shrink-0">
                <div className="flex w-full justify-between items-center sm:flex-row flex-col gap-4 sm:gap-0">
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-start">
                    {mode === 'edit' && basket?.id && (
                      <Button
                        type="button"
                        className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] w-full sm:w-auto"
                        onClick={() => setShowVersionHistory(true)}
                        disabled={isLoading}
                      >
                        View History
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                    <Button 
                      type="button" 
                      onClick={onClose} 
                      disabled={isLoading} 
                      className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-6 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!canSubmit || isLoading}
                      className="h-10 px-6 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm transition-all duration-300 ease-in-out flex items-center justify-center gap-2 outline-none disabled:opacity-50 disabled:pointer-events-none w-full sm:w-auto"
                    >
                      {createBasket.isPending || updateBasket.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {mode === 'create' ? 'Creating...' : 'Updating...'}
                        </>
                      ) : mode === 'create' ? (
                        'Create Basket'
                      ) : (
                        'Update Basket'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      {mode === 'edit' && basket?.id && (
        <>
          <VersionHistoryDialog
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            entityType="BASKET"
            entityId={basket.id}
            entityName={basket.name}
            onRollback={(versionNumber) => setRollbackVersion(versionNumber)}
            useCmsEndpoint={useCmsEndpoint}
          />

          <RollbackConfirmationDialog
            isOpen={rollbackVersion !== null}
            onClose={() => setRollbackVersion(null)}
            versionNumber={rollbackVersion!}
            isLoading={rollbackMutation.isPending}
            onConfirm={async () => {
              await rollbackMutation.mutateAsync({
                entityType: 'BASKET',
                entityId: basket.id,
                versionNumber: rollbackVersion!,
              });
              setRollbackVersion(null);
              setShowVersionHistory(false);
              onClose();
              onSuccess?.();
            }}
            entityName={basket.name}
          />
        </>
      )}
    </>
  );
}
