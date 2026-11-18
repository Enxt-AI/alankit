"use client";

import { useCreateOrder } from "@/hooks/use-orders";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import type { Stock } from "@/types/stock";
import type { OrderWithStock } from "@/types/order";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Building2, Loader2, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { getStorageUrl } from "@/lib/utils";

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: Stock;
  quantity: number;
  totalAmount: number;
  onSuccess: (order: OrderWithStock) => void;
}

export function OrderConfirmationModal({
  isOpen,
  onClose,
  stock,
  quantity,
  totalAmount,
  onSuccess,
}: OrderConfirmationModalProps) {
  const { mutateAsync, isPending } = useCreateOrder();
  const { user } = useAuthStore();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  // Redirect unverified users immediately
  useEffect(() => {
    if (isOpen && user?.kycStatus !== 'VERIFIED') {
      onClose();
      console.error('KYC verification is required to place orders.');
      router.replace('/kyc');
    }
  }, [isOpen, user?.kycStatus, onClose, router]);

  const handleConfirmOrder = async () => {
    // Defensive KYC check with redirect
    if (user?.kycStatus !== 'VERIFIED') {
      onClose();
      console.error('KYC verification is required. Please complete your KYC first.');
      router.replace('/kyc');
      return;
    }

    try {
      const order = await mutateAsync({
        stockId: stock.id,
        quantity,
      });

      // toast removed
      onClose();
      onSuccess(order);
    } catch (error: any) {
      console.error(error);
      console.error("Order creation error:", error);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onClose();
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-lg"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Confirm Your Order</DialogTitle>
          <DialogDescription>
            Please review your order details before confirming
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Stock Details */}
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {stock.logoUrl && !imageError ? (
                      <img
                        src={stock.logoUrl}
                        alt={`${stock.name} logo`}
                        className="h-12 w-12 rounded-lg object-contain"
                        width={48}
                        height={48}
                        decoding="async"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{stock.name}</h3>
                    <Badge variant="secondary" className="mt-1">
                      {stock.cin}
                    </Badge>
                  </div>
                </div>

                {/* Order Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-medium">
                      {quantity} {quantity === 1 ? "share" : "shares"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">
                      Price per share:
                    </span>
                    <span className="font-medium">
                      ₹{stock.price.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold">
                        Total Amount:
                      </span>
                      <span className="text-xl font-bold text-primary">
                        ₹{totalAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed">
              Your order will be placed with status PENDING. After payment verification, shares will be
              allocated by our team. You will receive confirmation emails at each step.
            </AlertDescription>
          </Alert>
        </div>

        {/* Actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {user?.kycStatus === 'VERIFIED' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-600 font-medium">KYC Verified</span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Go Back
          </Button>
          <Button
            onClick={handleConfirmOrder}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Placing Order...
              </>
            ) : (
              "Confirm Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
