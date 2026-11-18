'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, CreditCard, Shield, AlertCircle } from 'lucide-react';
import { useGenerateESignSession } from '@/hooks/use-orders';
import { Checkbox } from '@/components/ui/checkbox';
import type { OrderWithStock, OrderIntent } from '@/types/order';
import type { BasketWithConstituents } from '@/types/basket';
import { formatCurrencyINR } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderIntent: OrderIntent;
  onSuccess: (order: OrderWithStock) => void;
}

type PaymentStage = 'idle' | 'esigning' | 'error';

export function PaymentModal({ isOpen, onClose, orderIntent, onSuccess }: PaymentModalProps) {
  const router = useRouter();
  const isBasketOrder = !!orderIntent.basket;
  const constituents = Array.isArray(orderIntent.basket?.constituents) 
    ? orderIntent.basket?.constituents 
    : (orderIntent.basket?.constituents?.constituents || (typeof orderIntent.basket?.constituents === 'string' ? JSON.parse(orderIntent.basket.constituents).constituents : []));
  const [paymentStage, setPaymentStage] = useState<PaymentStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showConstituents, setShowConstituents] = useState(false);
  const [hasAcceptedAgreement, setHasAcceptedAgreement] = useState(false);

  const generateESignSessionMutation = useGenerateESignSession();

  // Reset stage explicitly when gracefully closed/opened
  useEffect(() => {
    if (isOpen) {
      setPaymentStage('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Force unlock pointer events when processing natively
  useEffect(() => {
    if (paymentStage === 'esigning') {
      document.body.style.setProperty('pointer-events', 'auto', 'important');
      return () => {
        document.body.style.removeProperty('pointer-events');
      };
    }
  }, [paymentStage]);

  const handlePayment = async () => {
    setPaymentStage('esigning');

    try {
      // 1. Store order intent for post-esign order creation
      localStorage.setItem('pendingOrderIntent', JSON.stringify(orderIntent));

      // 2. Generate eSign session — pass stock/basket intent so backend fills the PDF
      const intent = {
        stockId:   orderIntent.stock?.id   ?? undefined,
        basketId:  orderIntent.basket?.id  ?? undefined,
        quantity:  orderIntent.quantity,
        couponCode: orderIntent.couponCode ?? undefined,
      };
      const { docId } = await generateESignSessionMutation.mutateAsync(intent);

      // 3. Launch Digitap eSign — redirects to esign-success page after signing
      const digitapEnvVar = process.env.NEXT_PUBLIC_DIGITAP_ENV;
      const isProductionDomain = typeof window !== 'undefined' && window.location.hostname.includes('unlistedstox.com');
      const environment = (digitapEnvVar === 'production' || isProductionDomain) ? 'PRODUCTION' : 'UAT';
      const redirectUrl = `${window.location.origin}/payment/esign-success?docId=${docId}`;
      const errorUrl = `${window.location.origin}/payment/esign-success?docId=${docId}&error=true`;
      // Logo must be HTTPS and publicly reachable — Digitap's servers fetch it
      const logoUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`
        : 'https://www.unlistedstox.com/logo.png';
      
      const digitapParams = {
          environment, 
          doc_id: docId,
          logo: logoUrl,
          redirect_url: redirectUrl,
          error_url: errorUrl,
      };

      console.log('[Digitap eSign] Params:', JSON.stringify(digitapParams));

      if (typeof (window as any).digitappresign !== 'function') {
        throw new Error('Digitap eSign SDK is not completely loaded. Please refresh the page and try again.');
      }

      new (window as any).digitappresign(digitapParams);

    } catch (err: any) {
      setPaymentStage('error');
      setErrorMessage(err.message || 'Payment initialization failed');
      console.error(err);
    }
  };


  const handleRetry = () => {
    setPaymentStage('idle');
    setErrorMessage('');
    handlePayment();
  };

  const canClose = paymentStage !== 'esigning';

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && canClose) {
          onClose();
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Complete Payment
          </DialogTitle>
          <DialogDescription className="sr-only">
            Complete your order payment securely through Aadhaar e-Sign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  {isBasketOrder ? (
                    // Basket Order Summary
                    <div>
                      <h3 className="font-semibold text-lg">{orderIntent.basket?.name || 'Basket'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">Basket</Badge>
                        {constituents && constituents.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {constituents.length} Companies
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Stock Order Summary
                    <div>
                      <h3 className="font-semibold text-lg">{orderIntent.stock?.name || 'Stock'}</h3>
                      <p className="text-sm text-muted-foreground">{orderIntent.stock?.cin || ''}</p>
                    </div>
                  )}
                  <Badge variant="secondary">
                    {orderIntent.quantity} {isBasketOrder ? (orderIntent.quantity === 1 ? "basket" : "baskets") : (orderIntent.quantity === 1 ? "share" : "shares")}
                  </Badge>
                </div>

                {/* Basket Constituent Breakdown */}
                {isBasketOrder && constituents.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <button
                      onClick={() => setShowConstituents(!showConstituents)}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConstituents ? '▼' : '▶'} View Constituent Breakdown
                    </button>
                    {showConstituents && (
                      <div className="mt-2 space-y-1 text-xs">
                        {constituents.map((constituent: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div>
                              <span className="font-medium">{constituent.stockName || constituent.stock?.name || constituent.name}</span>
                              <span className="text-muted-foreground ml-2">({constituent.weight}%)</span>
                            </div>
                            <div className="text-right">
                              <div className="font-mono">{formatCurrencyINR(constituent.priceAtOrder || constituent.stock?.price || 0)}</div>
                              <div className="text-muted-foreground">
                                Weighted: {formatCurrencyINR((constituent.priceAtOrder || constituent.stock?.price || 0) * constituent.weight / 100)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isBasketOrder ? "Basket Price" : "Price per share"}
                    </span>
                    <span>{formatCurrencyINR(orderIntent.pricePerShare)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quantity</span>
                    <span>{orderIntent.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrencyINR(orderIntent.pricePerShare * orderIntent.quantity)}</span>
                  </div>
                  {orderIntent.discountAmount ? (
                    <div className="flex justify-between text-sm text-emerald-600 font-medium pb-1">
                      <span>Discount (Referral)</span>
                      <span>-{formatCurrencyINR(orderIntent.discountAmount)}</span>
                    </div>
                  ) : null}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Amount</span>
                    <span className="text-lg text-green-600">{formatCurrencyINR(orderIntent.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Stages */}
          {paymentStage === 'esigning' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-16 w-16 animate-spin text-[#528FF0] mb-4" />
              <p className="font-medium mb-2">Preparing e-Sign Document...</p>
              <p className="text-sm text-muted-foreground text-center">
                You will be redirected to Digitap for secure Aadhaar e-Signing.
              </p>
            </div>
          )}

          {paymentStage === 'idle' && (
            <div className="space-y-4">
              <div className="flex items-start space-x-2 pt-2 pb-2 pl-1">
                <Checkbox 
                  id="terms" 
                  checked={hasAcceptedAgreement} 
                  onCheckedChange={(c) => setHasAcceptedAgreement(!!c)} 
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I Accept the Stock Purchase Agreement
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                     You will be directed to Digitap to provide your Aadhaar e-Sign.
                  </p>
                </div>
              </div>
              <Button
                disabled={!hasAcceptedAgreement}
                onClick={handlePayment}
                className="w-full bg-[#528FF0] hover:bg-[#3d7ad6] text-white h-12 text-base font-medium"
                size="lg"
              >
                <Shield className="h-5 w-5 mr-2" />
                Proceed to e-Sign
              </Button>
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                <Shield className="h-3 w-3" />
                Digital eSign & Cashfree Payments Secured
              </p>
            </div>
          )}

          {paymentStage === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <Button onClick={handleRetry} variant="outline" className="w-full">
                Retry
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
