"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { orderFormSchema, type OrderFormValues } from "@/lib/validations/order-schema";
import { useCreateOrder } from "@/hooks/use-orders";
import { validateCoupon } from "@/lib/orders-api";
import { stocksApi } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import type { Stock } from "@/types/stock";
import type { BasketWithConstituents } from "@/types/basket";
import type { OrderWithStock, OrderIntent } from "@/types/order";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShoppingCart, Calculator, Building2, Info, Loader2, Package, Plus, Minus, Tag, Check, AlertCircle } from "lucide-react";
import { cn, getStorageUrl } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { DiscountSlab } from "@/types/stock";

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock?: Stock;
  basket?: BasketWithConstituents;
  onSuccess: (intent: OrderIntent) => void;
  /** When the user exceeded available stock and was redirected back, pass available qty here */
  maxQuantity?: number;
  /** Pre-filled error message to show in the form (e.g. after redirect from esign-success) */
  initialError?: string;
}

export function OrderFormModal({
  isOpen,
  onClose,
  stock,
  basket,
  onSuccess,
  maxQuantity,
  initialError,
}: OrderFormModalProps) {
  // Validate: exactly one of stock or basket must be provided
  if (!stock && !basket) {
    throw new Error('OrderFormModal: either stock or basket prop must be provided');
  }
  if (stock && basket) {
    throw new Error('OrderFormModal: cannot provide both stock and basket props');
  }

  const isBasketOrder = !!basket;
  const [imageError, setImageError] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [formError, setFormError] = useState(initialError || "");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; discountAmountPerShare?: number; minQuantity: number; maxQuantity: number; discountType?: string; discountPercentage?: number } | null>(null);
  const { user } = useAuthStore();
  const router = useRouter();

  // Redirect unverified users immediately
  useEffect(() => {
    if (isOpen && user?.kycStatus !== 'VERIFIED') {
      onClose();
      console.error('KYC verification is required to place orders.');
      router.replace('/kyc');
    }
  }, [isOpen, user?.kycStatus, onClose, router]);

  const minQty = (!isBasketOrder && stock?.minimumPurchaseQuantity) ? stock.minimumPurchaseQuantity : 1;
  const stockMaxQty = (!isBasketOrder && stock?.maximumPurchaseQuantity) ? stock.maximumPurchaseQuantity : undefined;
  const defaultQty = minQty;
  // Cap quantity at available stock if maxQuantity is provided
  const inventoryMaxQty = (!isBasketOrder && maxQuantity != null && maxQuantity > 0) ? maxQuantity : undefined;
  const effectiveMaxQty = stockMaxQty !== undefined && inventoryMaxQty !== undefined
    ? Math.min(stockMaxQty, inventoryMaxQty)
    : (stockMaxQty ?? inventoryMaxQty);

  const schema = useMemo(() => {
    let qtySchema = z
      .coerce.number()
      .int({ message: "Quantity must be a whole number" })
      .positive({ message: "Quantity must be positive" })
      .min(minQty, { message: `Minimum purchase quantity for this stock is ${minQty}.` });
    if (stockMaxQty !== undefined) {
      qtySchema = qtySchema.max(stockMaxQty, {
        message: `Maximum purchase quantity for this stock is ${stockMaxQty}.`,
      });
    }
    if (inventoryMaxQty !== undefined) {
      qtySchema = qtySchema.max(inventoryMaxQty, {
        message: `Only ${inventoryMaxQty} shares are available. Please reduce your quantity.`,
      });
    }
    return z.object({
      quantity: qtySchema,
      couponCode: z.string().optional(),
    });
  }, [minQty, stockMaxQty, inventoryMaxQty]);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      quantity: defaultQty,
    },
    mode: "onChange",
  });

  // Reset form when modal opens or defaultQty/maxQty changes
  useEffect(() => {
    if (isOpen) {
      const initialQty = effectiveMaxQty !== undefined ? Math.min(defaultQty, effectiveMaxQty) : defaultQty;
      form.reset({
        quantity: initialQty,
      });
      // Restore initial error when modal re-opens with an error prop
      setFormError(initialError || "");
    }
  }, [isOpen, defaultQty, effectiveMaxQty, initialError, form]);

  const quantity = form.watch("quantity", 0);
  const itemBasePrice = isBasketOrder ? (basket!.currentPrice || 0) : stock!.price;

  /**
   * Resolve the effective per-share price from the stock's discount slabs.
   * Mirrors the server-side `resolveSlabPrice()` logic so the UI stays
   * in sync with what the backend will actually charge.
   */
  const resolveSlabPrice = useCallback(
    (qty: number): number => {
      const slabs: DiscountSlab[] = (stock?.discountSlabs as DiscountSlab[] | null | undefined) ?? [];
      if (isBasketOrder || !slabs || slabs.length === 0) return itemBasePrice;
      const totalAmount = itemBasePrice * qty;
      const sorted = [...slabs]
        .filter((s) => s.minAmount > 0 && s.pricePerShare > 0)
        .sort((a, b) => b.minAmount - a.minAmount);
      const matched = sorted.find((s) => totalAmount >= s.minAmount);
      return matched ? matched.pricePerShare : itemBasePrice;
    },
    [isBasketOrder, itemBasePrice, stock?.discountSlabs],
  );

  const itemPrice = resolveSlabPrice(Number(quantity));
  const slabApplied = !isBasketOrder && itemPrice !== itemBasePrice;
  const totalAmount = Number(quantity) * itemPrice;

  // Dynamically compute the coupon discount based on quantity and resolved itemPrice
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const qty = Number(quantity);
    if (qty < appliedCoupon.minQuantity || (appliedCoupon.maxQuantity != null && qty > appliedCoupon.maxQuantity)) {
      return 0;
    }
    if (appliedCoupon.discountType === "PERCENTAGE" && appliedCoupon.discountPercentage) {
      return (itemPrice * qty) * (appliedCoupon.discountPercentage / 100);
    }
    // For FIXED discount (per share):
    const perShareDiscount = appliedCoupon.discountAmountPerShare ?? appliedCoupon.discountAmount;
    return perShareDiscount * qty;
  }, [appliedCoupon, quantity, itemPrice]);

  const finalTotalAmount = Math.max(totalAmount - couponDiscount, 0);

  // Capture excess-demand interest when user types a quantity > available inventory
  const interestFiredRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      !isBasketOrder &&
      stock &&
      effectiveMaxQty !== undefined &&
      Number(quantity) > effectiveMaxQty &&
      interestFiredRef.current !== Number(quantity)
    ) {
      interestFiredRef.current = Number(quantity);
      stocksApi.post(`/stocks/${stock.id}/interest`, {
        requestedQuantity: Number(quantity),
      }).catch(() => {
        // Silently ignore — this is best-effort demand telemetry
      });
    }
  }, [quantity, effectiveMaxQty, isBasketOrder, stock]);

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    if (isBasketOrder) {
      console.error("Referral codes are only valid for individual stocks, not baskets.");
      return;
    }
    
    setIsValidatingCoupon(true);
    setCouponError("");
    setAppliedCoupon(null);
    
    try {
      const qty = Number(quantity);
      const result = await validateCoupon(couponCodeInput.trim(), stock!.id, qty);
      if (qty < result.minQuantity || (result.maxQuantity != null && qty > result.maxQuantity)) {
        const rangeStr = result.minQuantity === result.maxQuantity
          ? `exactly ${result.minQuantity}`
          : `between ${result.minQuantity} and ${result.maxQuantity}`;
        setCouponError(`Referral code "${result.code}" is only valid for orders ${rangeStr} shares.`);
        return;
      }
      setAppliedCoupon({
        code: result.code,
        discountAmount: result.discountAmount,
        discountAmountPerShare: (result as any).discountAmountPerShare,
        minQuantity: result.minQuantity,
        maxQuantity: result.maxQuantity,
        discountType: result.discountType,
        discountPercentage: result.discountPercentage,
      });
    } catch (err: any) {
      setCouponError(err.message || "Invalid referral code");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput("");
    setCouponError("");
  };

  // Auto-invalidate coupon when quantity goes out of the coupon's valid range
  useEffect(() => {
    if (!appliedCoupon) return;
    const qty = Number(quantity);
    if (qty < appliedCoupon.minQuantity || qty > appliedCoupon.maxQuantity) {
      const rangeStr = appliedCoupon.minQuantity === appliedCoupon.maxQuantity
        ? `exactly ${appliedCoupon.minQuantity}`
        : `between ${appliedCoupon.minQuantity} and ${appliedCoupon.maxQuantity}`;
      setCouponError(`Referral code "${appliedCoupon.code}" requires ${rangeStr} shares. Code removed.`);
      setAppliedCoupon(null);
    }
  }, [quantity, appliedCoupon]);

  const handleSubmit = async (values: OrderFormValues) => {
    // Defensive KYC check with redirect
    if (user?.kycStatus !== 'VERIFIED') {
      onClose();
      console.error('KYC verification is required. Please complete your KYC first.');
      router.replace('/kyc');
      return;
    }

    if (appliedCoupon) {
      const qty = Number(values.quantity);
      if (qty < appliedCoupon.minQuantity || (appliedCoupon.maxQuantity != null && qty > appliedCoupon.maxQuantity)) {
        const rangeStr = appliedCoupon.minQuantity === appliedCoupon.maxQuantity
          ? `exactly ${appliedCoupon.minQuantity}`
          : `between ${appliedCoupon.minQuantity} and ${appliedCoupon.maxQuantity}`;
        setFormError(
          `Referral code "${appliedCoupon.code}" requires ${rangeStr} shares. Please adjust your quantity or remove the coupon.`
        );
        return;
      }
    }

    const orderIntent: OrderIntent = {
      quantity: values.quantity,
      pricePerShare: itemPrice,
      totalAmount,
      stock: stock ? {
        id: stock.id,
        name: stock.name,
        cin: stock.cin,
        logoUrl: stock.logoUrl,
        price: stock.price
      } : undefined,
      basket: basket ? {
        id: basket.id,
        name: basket.name,
        iconUrl: basket.iconUrl,
        currentPrice: basket.currentPrice || 0,
        constituents: basket.constituents
      } : undefined,
      couponCode: appliedCoupon?.code,
      discountAmount: couponDiscount,
    };

    form.reset();
    setImageError(false);
    setCouponCodeInput("");
    setAppliedCoupon(null);
    setCouponError("");
    setFormError("");
    onClose();
    onSuccess(orderIntent);
  };

  const handleClose = () => {
    form.reset();
    setImageError(false);
    setCouponCodeInput("");
    setAppliedCoupon(null);
    setCouponError("");
    setFormError("");
    onClose();
  };
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-lg p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-sm sm:rounded-sm max-h-[92vh] sm:max-h-[90vh] overflow-y-auto bg-white overscroll-contain">
        <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 pr-8 leading-snug break-words">
              {isBasketOrder ? `Invest in ${basket.name}` : `Buy ${stock!.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 mt-1">
              Review your order and enter the quantity you want to purchase
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-4 sm:px-6 md:px-8 py-5 sm:py-6">
          {/* Quantity / Availability Error Banner */}
          {formError && (
            <div className="mb-4 sm:mb-5 flex items-start gap-3 rounded-sm border border-red-200 bg-red-50 px-3.5 py-2.5 sm:px-4 sm:py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-xs sm:text-sm font-medium text-red-700">{formError}</p>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-5">
              {/* Asset Summary Card */}
              <div className="flex items-center justify-between p-3 sm:p-3.5 bg-slate-50 rounded-sm border border-slate-200">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    {isBasketOrder ? (
                      basket.iconUrl && !imageError ? (
                        <img
                          src={getStorageUrl(basket.iconUrl)}
                          alt={`${basket.name} icon`}
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-sm object-cover shadow-xs border border-slate-200"
                          width={48}
                          height={48}
                          decoding="async"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-sm bg-white border border-slate-200 shadow-xs">
                          <Package className="h-5 w-5 text-slate-400" />
                        </div>
                      )
                    ) : (
                      stock!.logoUrl && !imageError ? (
                        <img
                          src={getStorageUrl(stock!.logoUrl)}
                          alt={`${stock!.name} logo`}
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-sm object-contain bg-white shadow-xs p-1 border border-slate-200"
                          width={48}
                          height={48}
                          decoding="async"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-sm bg-white border border-slate-200 shadow-xs">
                          <Building2 className="h-5 w-5 text-slate-400" />
                        </div>
                      )
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 text-xs sm:text-sm md:text-[15px] truncate">
                      {isBasketOrder ? basket.name : stock!.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5 sm:gap-2">
                      <Badge variant="secondary" className="bg-white border-slate-200 text-slate-600 text-[10px] sm:text-[11px] px-1.5 py-0 font-normal rounded-sm">
                        {isBasketOrder ? basket.category : (stock!.cin || stock!.isin || "Unlisted")}
                      </Badge>
                      {isBasketOrder && (
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">
                          {basket.constituents?.length || 0} Companies
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-2 sm:pl-3">
                  <div className="text-sm sm:base font-bold text-slate-900">
                    ₹{itemPrice.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                    {isBasketOrder ? "per basket" : "per share"}
                  </div>
                </div>
              </div>

              {/* Quantity Stepper */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center">
                      <FormLabel className="text-xs sm:text-sm font-semibold text-slate-700">Quantity</FormLabel>
                      <div className="flex items-center gap-1.5">
                        {minQty > 1 && (
                          <span className="text-[11px] sm:text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                            Min: {minQty} {isBasketOrder ? "baskets" : "shares"}
                          </span>
                        )}
                        {stockMaxQty && (
                          <span className="text-[11px] sm:text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                            Max: {stockMaxQty} shares
                          </span>
                        )}
                      </div>
                    </div>
                    <FormControl>
                      <div className="flex items-center border border-slate-300 rounded-sm bg-white p-0.5 sm:p-1 shadow-xs focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-500/20 transition-all">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 sm:h-10 w-10 sm:w-12 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-colors disabled:opacity-30"
                          onClick={() => field.onChange(Math.max(minQty, Number(field.value) - 1))}
                          disabled={Number(field.value) <= minQty}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={minQty}
                          max={effectiveMaxQty}
                          step={1}
                          autoFocus
                          className="h-9 sm:h-10 text-center text-base sm:text-lg font-bold border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 bg-transparent rounded-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          {...field}
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 sm:h-10 w-10 sm:w-12 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-colors disabled:opacity-30"
                          onClick={() => field.onChange(Number(field.value) + 1)}
                          disabled={effectiveMaxQty !== undefined && Number(field.value) >= effectiveMaxQty}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Referral Code Section */}
              {!isBasketOrder && (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-slate-400" /> Referral Code
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="e.g. DISCOUNT50"
                        value={couponCodeInput}
                        onChange={(e) => {
                          setCouponCodeInput(e.target.value.toUpperCase());
                          setCouponError("");
                        }}
                        disabled={!!appliedCoupon || isValidatingCoupon}
                        className={cn(
                          "h-10 sm:h-11 rounded-sm bg-slate-50/50 border-slate-300 font-medium uppercase transition-colors focus-visible:ring-1 focus-visible:ring-green-500 text-xs sm:text-sm", 
                          couponError && "border-red-500 focus-visible:ring-red-500",
                          appliedCoupon && "border-green-500 bg-green-50/30 text-green-700"
                        )}
                      />
                      {appliedCoupon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                    </div>
                    {!appliedCoupon ? (
                      <Button 
                        type="button" 
                        variant="secondary" 
                        className="h-10 sm:h-11 rounded-sm px-4 sm:px-5 font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm"
                        onClick={handleApplyCoupon}
                        disabled={!couponCodeInput.trim() || isValidatingCoupon || quantity < 1}
                      >
                        {isValidatingCoupon && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        Apply
                      </Button>
                    ) : (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={handleRemoveCoupon} 
                        className="h-10 sm:h-11 rounded-sm px-3 sm:px-4 text-red-500 hover:text-red-600 hover:bg-red-50 font-medium text-xs sm:text-sm"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {couponError && <p className="text-xs font-medium text-red-500 pl-1">{couponError}</p>}
                </div>
              )}

              {/* Volume Pricing Slabs Table */}
              {!isBasketOrder && stock?.discountSlabs && (stock.discountSlabs as DiscountSlab[]).length > 0 && (() => {
                const sortedSlabs = [...(stock.discountSlabs as DiscountSlab[])]
                  .filter(s => s.minAmount > 0 && s.pricePerShare > 0)
                  .sort((a, b) => a.minAmount - b.minAmount);
                const currentAmount = (Number(quantity) || 0) * itemBasePrice;
                const nextSlab = sortedSlabs.find(s => currentAmount < s.minAmount);
                return (
                  <div className="space-y-1.5 sm:space-y-2">
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 bg-violet-500 inline-block"></span>
                      Volume Pricing
                    </p>
                    <div className="rounded-sm border border-violet-200 overflow-hidden">
                      <div className="grid grid-cols-2 px-2.5 sm:px-3 py-1.5 bg-violet-50 border-b border-violet-200">
                        <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">Min Amount</span>
                        <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider text-right">Price / Share</span>
                      </div>
                      {sortedSlabs.map((slab, i) => {
                        const isActive = itemPrice === slab.pricePerShare && slabApplied;
                        const isNext = slab === nextSlab;
                        const moreNeeded = slab.minAmount - currentAmount;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "grid grid-cols-2 px-2.5 sm:px-3 py-2 border-b border-violet-100 last:border-b-0 transition-colors text-xs sm:text-sm items-center",
                              isActive && "bg-green-50",
                              isNext && !isActive && "bg-amber-50",
                            )}
                          >
                            <div className={cn(
                              "font-medium flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0",
                              isActive ? "text-green-700 font-bold" : isNext ? "text-amber-700" : "text-slate-600"
                            )}>
                              <span>
                                {isActive && <span className="mr-1">✓</span>}
                                ₹{slab.minAmount.toLocaleString("en-IN")}+
                              </span>
                              {isNext && (
                                <span className="text-[9px] sm:text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-sm px-1.5 py-0.5 whitespace-nowrap">
                                  +₹{moreNeeded.toLocaleString("en-IN")} more
                                </span>
                              )}
                            </div>
                            <span className={cn(
                              "font-semibold text-right text-xs sm:text-sm shrink-0 pl-2",
                              isActive ? "text-green-700 font-bold" : isNext ? "text-amber-700 font-bold" : "text-slate-700"
                            )}>
                              ₹{slab.pricePerShare.toLocaleString("en-IN")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Order Summary Card */}
              <div className="rounded-sm border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2.5 sm:mb-3 text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5 text-slate-400" /> Order Summary
                  </span>
                </div>
                <div className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Quantity</span>
                    <span className="font-semibold text-slate-800">
                      {quantity || 0} {isBasketOrder ? (quantity === 1 ? "basket" : "baskets") : (quantity === 1 ? "share" : "shares")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">
                      {isBasketOrder ? "Basket Price" : "Price per share"}
                    </span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      {slabApplied && (
                        <span className="line-through text-slate-400 text-xs">
                          ₹{itemBasePrice.toLocaleString("en-IN")}
                        </span>
                      )}
                      ₹{itemPrice.toLocaleString("en-IN")}
                      {slabApplied && (
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded-sm px-1.5 py-0.5">SLAB</span>
                      )}
                    </span>
                  </div>

                  {isBasketOrder && basket.constituents && basket.constituents.length > 0 && (
                    <details className="mt-2 group">
                      <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600 select-none flex items-center gap-1">
                        View Constituent Breakdown
                      </summary>
                      <div className="mt-2 space-y-1.5 rounded-sm border border-slate-200 bg-white p-2.5 sm:p-3 text-xs shadow-xs">
                        {basket.constituents.map((constituent) => (
                          <div key={constituent.id} className="flex justify-between items-center">
                            <span className="text-slate-600 font-medium line-clamp-1 flex-1 pr-2">
                              {constituent.stock.name} <span className="text-slate-400">({constituent.weight.toFixed(1)}%)</span>
                            </span>
                            <span className="font-semibold text-slate-800 shrink-0">
                              ₹{(itemPrice * constituent.weight / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {appliedCoupon && (
                    <div className="flex justify-between items-center text-green-600 bg-green-50/50 -mx-1 sm:-mx-2 px-2 py-1 rounded-sm border border-green-200/50">
                      <span className="font-medium flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" /> Referral Discount
                      </span>
                      <span className="font-bold">
                        -₹{couponDiscount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2.5 sm:pt-3 mt-2 flex justify-between items-center">
                    <span className="font-semibold text-slate-900">Total Amount</span>
                    <span className="text-xl sm:text-2xl font-extrabold text-green-600 tracking-tight">
                      ₹{finalTotalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button & Disclaimer */}
              <div className="pt-1 sm:pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 rounded-sm text-sm sm:text-[15px] font-semibold shadow-xs bg-green-600 hover:bg-green-700 text-white transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={!form.formState.isValid || quantity < minQty}
                >
                  <span>Continue to Payment</span>
                  <span>→</span>
                </Button>
                <p className="text-center text-[11px] sm:text-xs font-medium text-slate-400 mt-2.5 sm:mt-3 flex items-center justify-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Final price will be calculated at checkout based on current market price
                </p>
              </div>

            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
