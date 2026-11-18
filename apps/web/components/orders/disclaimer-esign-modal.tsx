'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, TrendingUp, Shield, Lock, FileText, Search, Info, PenLine, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { useGenerateESignSession } from '@/hooks/use-orders';
import type { OrderIntent } from '@/types/order';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DisclaimerEsignModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderIntent: OrderIntent | null;
}

type PaymentStage = 'idle' | 'esigning' | 'error';

export function DisclaimerEsignModal({
  isOpen,
  onClose,
  orderIntent
}: DisclaimerEsignModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [paymentStage, setPaymentStage] = useState<PaymentStage>('idle');
  const [loadingStep, setLoadingStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');

  const generateESignSessionMutation = useGenerateESignSession();

  const handleClose = () => {
    if (paymentStage === 'esigning') return;
    setAccepted(false);
    setPaymentStage('idle');
    setErrorMessage('');
    onClose();
  };

  const handleAccept = async () => {
    if (!accepted || !orderIntent) return;
    setPaymentStage('esigning');
    setLoadingStep(1);
    setErrorMessage('');

    try {
      // 1. Store order intent in localStorage for post-esign order creation
      localStorage.setItem('pendingOrderIntent', JSON.stringify(orderIntent));

      // UI Polish: Simulate first step completion
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoadingStep(2);

      // 2. Generate e-sign session (no order created yet)
      // Backend will: generate-esign → upload PDF to S3 → return docId
      const sessionIntent = {
        stockId: orderIntent.stock?.id,
        basketId: orderIntent.basket?.id,
        quantity: orderIntent.quantity,
        couponCode: orderIntent.couponCode,
      };
      
      const { docId } = await generateESignSessionMutation.mutateAsync(sessionIntent);

      // UI Polish: Show final step before redirect
      setLoadingStep(3);
      await new Promise(resolve => setTimeout(resolve, 800));

      // 3. Launch Digitap eSign SDK
      const digitapEnvVar = process.env.NEXT_PUBLIC_DIGITAP_ENV;
      const isProductionDomain = typeof window !== 'undefined' && window.location.hostname.includes('unlistedstox.com');
      const environment = (digitapEnvVar === 'production' || isProductionDomain) ? 'PRODUCTION' : 'UAT';
      const redirectUrl = `${window.location.origin}/payment/esign-success?docId=${docId}`;
      const errorUrl = `${window.location.origin}/payment/esign-success?docId=${docId}&error=true`;
      const logoUrl = 'https://www.unlistedstox.com/logo.png';
      
      const params = {
          environment, 
          doc_id: docId,
          logo: logoUrl,
          redirect_url: redirectUrl,
          error_url: errorUrl,
      };

      console.log('[Digitap eSign] Params:', JSON.stringify(params));

      if (typeof (window as any).digitappresign !== 'function') {
        throw new Error('Digitap eSign SDK is not completely loaded. Please refresh the page and try again.');
      }

      new (window as any).digitappresign(params);

    } catch (err: any) {
      setPaymentStage('error');
      setErrorMessage(err.message || 'Failed to initialize e-Sign session');
      console.error(err);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent 
         className={`p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-sm max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain transition-all duration-500 ${
           paymentStage === 'idle'
             ? 'sm:max-w-lg w-[calc(100vw-2rem)] sm:w-full bg-white'
             : paymentStage === 'esigning'
             ? 'sm:max-w-md w-full !bg-transparent !shadow-none [&>button]:hidden ring-0 border-0'
             : 'sm:max-w-sm w-[calc(100vw-2rem)] sm:w-full bg-white'
         }`}
         onPointerDownOutside={(e) => {
           if (paymentStage === 'esigning') e.preventDefault();
         }}
      >
        {/* Visually hidden titles for accessibility during loading stages */}
        {paymentStage === 'esigning' && (
          <div className="sr-only">
            <DialogTitle>Processing</DialogTitle>
            <DialogDescription>Please wait while we prepare your e-Sign session.</DialogDescription>
          </div>
        )}

        {paymentStage === 'idle' ? (
          <div className="flex flex-col bg-white px-5 sm:px-8 py-6 sm:py-9 items-center text-center">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 mb-4 sm:mb-5 items-center justify-center rounded-sm bg-amber-50 border border-amber-200 text-amber-500">
              <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-2 sm:mb-3">
              Important Disclaimer
            </DialogTitle>
            
            <DialogDescription className="text-xs sm:text-[15px] text-slate-600 leading-relaxed max-w-sm mx-auto mb-6 sm:mb-8">
              Please read the terms carefully before proceeding.<br/>
              You must accept these conditions to sign the agreement digitally.
            </DialogDescription>

            <div className="w-full border-t border-slate-100 mb-5 sm:mb-6"></div>

            <div className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6 w-full text-left">
              <Checkbox
                id="disclaimer-accept"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
                className="mt-0.5 sm:mt-1 h-4 w-4 sm:h-5 sm:w-5 shrink-0 rounded-sm border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 transition-all"
              />
              <label
                htmlFor="disclaimer-accept"
                className="text-xs sm:text-[14px] leading-relaxed text-slate-700 cursor-pointer select-none"
              >
                I have read and agree to the{" "}
                <a
                  href="/legal-policies/terms-and-conditions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 font-medium hover:underline"
                >
                  terms
                </a>
                . I understand the risks involved and wish to proceed with the e-Sign agreement.
              </label>
            </div>

            <div className="w-full flex justify-start text-left -mt-2 mb-6 sm:mb-8">
              <a
                href="/legal-policies/terms-and-conditions/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Read Terms & Conditions</span>
                <span className="text-xs">&gt;</span>
              </a>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-4 w-full mb-5 sm:mb-6">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 h-11 sm:h-12 rounded-sm text-xs sm:text-[15px] font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 px-2 sm:px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAccept}
                disabled={!accepted}
                className="flex-[1.6] sm:flex-[1.5] h-11 sm:h-12 rounded-sm text-[11.5px] sm:text-[15px] font-semibold shadow-xs bg-green-600 hover:bg-green-700 text-white transition-all active:scale-[0.99] disabled:opacity-50 px-2 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap"
              >
                <span>Accept & Proceed to e-Sign</span>
                <span>→</span>
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs text-slate-500 w-full">
              <Lock className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span>Your information is secure and will not be shared with third parties.</span>
            </div>
          </div>
        ) : paymentStage === 'esigning' ? (
          <div className="flex flex-col w-full min-h-[460px] relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            {/* Clean light gradient radial for contrast */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="flex flex-col items-center justify-center flex-1 px-8 pt-12 pb-8 relative z-10">
              {/* Animated circular loader around the pen icon */}
              <div className="relative flex items-center justify-center mb-8">
                <div className="absolute w-[92px] h-[92px] rounded-full border-4 border-white/20"></div>
                <div className="absolute w-[92px] h-[92px] rounded-full border-4 border-transparent border-t-white border-r-white animate-[spin_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite]"></div>
                
                {/* Clean Transparent Inner Inset */}
                <div className="relative w-20 h-20 rounded-full flex items-center justify-center z-10">
                  <PenLine className="h-10 w-10 text-white drop-shadow-md" strokeWidth={1.5} />
                </div>
              </div>

              <h3 className="font-medium text-2xl tracking-tight text-white mb-2 drop-shadow-sm">
                Preparing Document
              </h3>
              <p className="text-sm text-white/70 mb-8 text-center max-w-[280px] leading-relaxed">
                Please wait while we establish a secure connection to the NSDL gateway.
              </p>

              {/* Progress Steps */}
              <div className="w-full max-w-[280px] flex flex-col gap-4 mb-2">
                 {/* Step 1: Identity verification */}
                 <div className={`flex items-center gap-3.5 transition-opacity duration-300 ${loadingStep < 1 ? 'opacity-50' : 'opacity-100'}`}>
                    {loadingStep > 1 ? (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                         <ShieldCheck className="w-4 h-4" />
                      </div>
                    ) : loadingStep === 1 ? (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white shadow-sm relative overflow-hidden">
                         <div className="absolute inset-0 bg-white/5 animate-pulse" />
                         <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-white/50">
                         <ShieldCheck className="w-4 h-4" />
                      </div>
                    )}
                    <span className={`text-[14px] font-medium transition-colors ${loadingStep > 1 ? 'text-emerald-400' : loadingStep === 1 ? 'text-white drop-shadow-sm' : 'text-white/50'}`}>Identity verification</span>
                 </div>

                 {/* Step 2: Secure session */}
                 <div className={`flex items-center gap-3.5 transition-opacity duration-300 ${loadingStep < 2 ? 'opacity-50' : 'opacity-100'}`}>
                    {loadingStep > 2 ? (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                         <Lock className="w-4 h-4" />
                      </div>
                    ) : loadingStep === 2 ? (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white shadow-sm relative overflow-hidden">
                         <div className="absolute inset-0 bg-white/5 animate-pulse" />
                         <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-white/50">
                         <Lock className="w-4 h-4" />
                      </div>
                    )}
                    <span className={`text-[14px] font-medium transition-colors ${loadingStep > 2 ? 'text-emerald-400' : loadingStep === 2 ? 'text-white drop-shadow-sm' : 'text-white/50'}`}>Secure session</span>
                 </div>

                 {/* Step 3: Document signing */}
                 <div className={`flex items-center gap-3.5 transition-opacity duration-300 ${loadingStep < 3 ? 'opacity-50' : 'opacity-100'}`}>
                    {loadingStep > 3 ? (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                         <FileText className="w-4 h-4" />
                      </div>
                    ) : loadingStep === 3 ? (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white shadow-sm relative overflow-hidden">
                         <div className="absolute inset-0 bg-white/5 animate-pulse" />
                         <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-white/50">
                         <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <span className={`text-[14px] font-medium transition-colors ${loadingStep > 3 ? 'text-emerald-400' : loadingStep === 3 ? 'text-white drop-shadow-sm' : 'text-white/50'}`}>Document signing</span>
                 </div>
              </div>
            </div>

            {/* Bottom SSL Trust Badge & Progress Bar */}
            <div className="relative overflow-hidden flex flex-col items-center justify-center py-5 mt-auto z-10">
               <div className="flex items-center gap-2 text-[12px] font-bold tracking-wide uppercase text-white/50 mb-1">
                 <Lock className="w-3.5 h-3.5 text-emerald-400" />
                 Secured by unlisted-stox
               </div>
               
               {/* Smooth Progress Bar */}
               <div className="absolute bottom-0 left-12 right-12 h-1 bg-white/10 overflow-hidden rounded-full">
                 <div className="h-full bg-emerald-400 rounded-full w-full animate-pulse opacity-80" />
               </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-10 min-h-[320px] bg-white rounded-sm">
            <div className="relative mb-6">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-red-50 border border-red-200 rounded-sm flex items-center justify-center z-10">
                <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-red-500" />
              </div>
            </div>
            
            <DialogTitle className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 mb-2">Connection Failed</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 max-w-[280px] mb-6 sm:mb-8 leading-relaxed text-center">
              {errorMessage || "We couldn't initialize the e-Sign session. Please try again."}
            </DialogDescription>
            
            <div className="flex items-center justify-center gap-3 w-full max-w-[280px]">
               <Button 
                 type="button" 
                 variant="outline" 
                 onClick={handleClose} 
                 className="flex-1 h-10 sm:h-11 rounded-sm text-xs sm:text-sm font-semibold border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
               >
                 Cancel
               </Button>
               <Button 
                 onClick={() => setPaymentStage('idle')} 
                 className="flex-1 h-10 sm:h-11 rounded-sm text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-[0.99] transition-all"
               >
                 Try Again
               </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
