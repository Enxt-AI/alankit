"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import type { Stock } from "@/types/stock";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Building2, Calculator, Info, Loader2, Plus, Minus } from "lucide-react";
import { getStorageUrl } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useCreateSellRequest } from "@/hooks/use-sell-requests";
import type { CreateSellRequestDto } from "@/types/sell-request";

const sellFormSchema = z.object({
  quantity: z
    .number()
    .min(1, "Minimum quantity is 1")
    .max(9999999, "Quantity is too high"),
  pricePerShare: z
    .number()
    .min(0.01, "Price must be greater than 0")
    .max(9999999, "Price is too high"),
});

export type SellFormValues = z.infer<typeof sellFormSchema>;

interface SellFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: Stock;
  onSuccess: () => void;
}

export function SellFormModal({
  isOpen,
  onClose,
  stock,
  onSuccess,
}: SellFormModalProps) {
  const [imageError, setImageError] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();
  const { mutateAsync: createSellRequest, isPending } = useCreateSellRequest();
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<SellFormValues>({
    resolver: zodResolver(sellFormSchema),
    defaultValues: {
      quantity: 1,
      pricePerShare: stock.price, // Default to current listing price
    },
  });

  const quantity = form.watch("quantity") || 0;
  const pricePerShare = form.watch("pricePerShare") || 0;
  const totalAmount = useMemo(() => quantity * pricePerShare, [quantity, pricePerShare]);

  const handleSubmit = async (values: SellFormValues) => {
    if (isPending || isSubmitted) return;
    setSubmitError("");
    
    // Defensive verification checks with redirect
    if (user?.kycStatus !== 'VERIFIED') {
      onClose();
      console.error('KYC verification is required.');
      router.replace('/kyc');
      return;
    }
    if (user?.dematStatus !== 'VERIFIED') {
      onClose();
      console.error('Demat account verification is required.');
      router.replace('/demat');
      return;
    }
    if (user?.bankStatus !== 'VERIFIED') {
      onClose();
      console.error('Bank account verification is required.');
      router.replace('/bank');
      return;
    }

    const dto: CreateSellRequestDto = {
      stockId: stock.id,
      quantity: values.quantity,
      pricePerShare: values.pricePerShare,
    };

    try {
      await createSellRequest(dto);
      setIsSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit sell request.");
    }
  };

  const handleClose = () => {
    if (isPending) return;
    if (isSubmitted) {
      setIsSubmitted(false);
      form.reset({ quantity: 1, pricePerShare: stock.price });
      onSuccess();
    } else {
      onClose();
    }
    setSubmitError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[820px] gap-0 p-0 overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-2xl">
        {isSubmitted ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center px-6 py-10 text-center sm:px-10">
            <div aria-hidden="true" className="sell-success-icon mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
              <svg viewBox="0 0 52 52" className="h-16 w-16 fill-none stroke-emerald-600" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="26" cy="26" r="23" className="sell-success-circle" pathLength="1" />
                <path d="m15 26 7 7 15-15" className="sell-success-check" pathLength="1" />
              </svg>
            </div>
            <DialogHeader className="items-center sm:text-center" role="status" aria-live="polite">
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Sell request submitted successfully!
              </DialogTitle>
              <DialogDescription className="max-w-md pt-2 text-sm leading-relaxed text-slate-500">
                We’ve received your sell request. Our team will contact you to finalize the transaction.
              </DialogDescription>
            </DialogHeader>
            <Button autoFocus onClick={handleClose} className="mt-7 h-11 w-full max-w-xs rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700">
              Done
            </Button>
          </div>
        ) : (
        <>
        <div className="bg-gradient-to-br from-slate-50 to-white px-4 sm:px-6 py-4 border-b border-slate-100">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 border border-red-200">
                <span className="text-red-600 font-bold text-base sm:text-lg">S</span>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 pr-8">
                Sell Request
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 font-medium">
              Let us know how many shares you want to sell and your expected rate. Our team will contact you.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5">
          {submitError && (
            <div className="mb-4 sm:mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 sm:px-4 sm:py-3">
              <p className="text-xs sm:text-sm font-medium text-red-700">{submitError}</p>
            </div>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} aria-busy={isPending}>
              <fieldset disabled={isPending} className="min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-x-6 sm:gap-y-4">
                
                {/* 1. Stock Summary (Top Right on Desktop, Top on Mobile) */}
                <div className="min-w-0 sm:col-start-2 sm:row-start-1">
                  <div className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200 h-full">
                    <div className="flex-shrink-0">
                      {stock.logoUrl && !imageError ? (
                        <img
                          src={getStorageUrl(stock.logoUrl)}
                          alt={`${stock.name} logo`}
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-contain bg-white shadow-xs p-1 border border-slate-200"
                          width={56}
                          height={56}
                          decoding="async"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-xs">
                          <Building2 className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm sm:text-base line-clamp-1">{stock.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">
                          Current Listed Price: ₹{stock.price.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Form Fields (Left on Desktop, Middle on Mobile) */}
                <div className="min-w-0 sm:col-start-1 sm:row-start-1 sm:row-span-2 space-y-3 sm:space-y-4">
                  {/* Quantity Input */}
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm font-semibold text-slate-700">Quantity to Sell</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="absolute left-1 top-1 bottom-1 h-9 sm:h-10 w-9 sm:w-10 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg z-10"
                              onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                              disabled={Number(field.value) <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              className="h-11 sm:h-12 text-center text-base sm:text-lg font-bold rounded-xl border-slate-300 bg-white shadow-xs focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="absolute right-1 top-1 bottom-1 h-9 sm:h-10 w-9 sm:w-10 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg z-10"
                              onClick={() => field.onChange(Number(field.value) + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Price Per Share Input */}
                  <FormField
                    control={form.control}
                    name="pricePerShare"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm font-semibold text-slate-700">Your Asking Rate (₹ per share)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</div>
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              className="h-11 sm:h-12 pl-8 text-base sm:text-lg font-bold rounded-xl border-slate-300 bg-white shadow-xs focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 3. Order Summary Calc (Bottom Right on Desktop, Bottom on Mobile) */}
                <div className="min-w-0 sm:col-start-2 sm:row-start-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 shadow-xs h-full flex flex-col justify-center">
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3 flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-slate-400" />
                      Summary
                    </h4>
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Quantity</span>
                        <span className="font-semibold text-slate-900">
                          {quantity || 0} {quantity === 1 ? "share" : "shares"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Asking Rate</span>
                        <span className="font-semibold text-slate-900">
                          ₹{pricePerShare.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
                        <span className="font-semibold text-slate-900">Expected Value</span>
                        <span className="text-xl sm:text-2xl font-bold text-red-600 tracking-tight">
                          ₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Notice & Actions */}
              <div className="mt-4 pt-3 sm:pt-4 border-t border-slate-100">
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 rounded-xl text-sm sm:text-base font-semibold shadow-sm bg-red-600 hover:bg-red-500 text-white transition-all active:scale-[0.99] disabled:opacity-50"
                  disabled={!form.formState.isValid || isPending}
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />}
                  {isPending ? "Submitting your request…" : "Submit Sell Request"}
                </Button>
                <p className="text-center text-[11px] sm:text-xs font-medium text-slate-400 mt-2 sm:mt-3 flex items-center justify-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Our team will contact you to finalize the transaction.
                </p>
              </div>
              </fieldset>
            </form>
          </Form>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
