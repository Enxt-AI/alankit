"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderWithStock } from "@/types/order";
import type { BasketWithConstituents } from "@/types/basket";
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
import { CheckCircle, Copy, ArrowRight, Mail, ChevronDown, ChevronUp } from "lucide-react";

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithStock;
}

export function OrderSuccessModal({
  isOpen,
  onClose,
  order,
}: OrderSuccessModalProps) {
  const isBasketOrder = !!order.basketId;
  const constituents = Array.isArray(order.basketConstituents) 
    ? order.basketConstituents 
    : (order.basketConstituents?.constituents || (typeof order.basketConstituents === 'string' ? JSON.parse(order.basketConstituents).constituents : []));
  const [showConstituents, setShowConstituents] = useState(false);
  const router = useRouter();

  const handleCopyOrderId = () => {
    navigator.clipboard
      .writeText(order.orderNumber || order.cashfreeOrderId || order.id)
      .then(() => {
        console.log("Order ID copied to clipboard");
      })
      .catch(() => {
        console.error("Failed to copy Order ID");
      });
  };

  const handleContinueShopping = () => {
    onClose();
    router.push("/dashboard");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        {/* Success Icon */}
        <div className="flex justify-center pt-6">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
        </div>

        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl">
            Order Initiated Successfully!
          </DialogTitle>
          <DialogDescription>
            Your order has been received and is being processed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Details */}
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Order ID */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    ORDER ID
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {order.orderNumber || `ORD-${order.id.slice(-6).toUpperCase()}`}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyOrderId}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Stock Details */}
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground font-medium mb-2">
                    {isBasketOrder ? "BASKET DETAILS" : "STOCK DETAILS"}
                  </p>
                  <div className="flex items-center justify-between">
                    {isBasketOrder ? (
                      <div>
                        <p className="font-semibold">{order.basket?.name || 'Basket'}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">Basket</Badge>
                          {constituents.length > 0 && (
                            <Badge variant="outline">
                              {constituents.length} Companies
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold">{order.stock?.name || 'Stock'}</p>
                        <Badge variant="secondary" className="mt-1">
                          {order.stock?.cin || ''}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Basket Constituent Breakdown */}
                {isBasketOrder && constituents.length > 0 && (
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => setShowConstituents(!showConstituents)}
                      className="flex items-center justify-between w-full text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      <span>CONSTITUENT BREAKDOWN</span>
                      {showConstituents ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {showConstituents && (
                      <div className="mt-3 space-y-2">
                        {constituents.map((constituent: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center p-2 bg-muted rounded-md text-sm"
                          >
                            <div className="flex-1">
                              <p className="font-medium">
                                {constituent.stockName || constituent.stock?.name || constituent.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Weight: {constituent.weight}%
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-sm">
                                ₹{(constituent.priceAtOrder || constituent.stock?.price || 0).toLocaleString("en-IN")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ₹{((constituent.priceAtOrder || constituent.stock?.price || 0) * constituent.weight / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Order Summary */}
                <div className="pt-4 border-t space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-medium">
                      {order.quantity} {isBasketOrder ? (order.quantity === 1 ? "basket" : "baskets") : (order.quantity === 1 ? "share" : "shares")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {isBasketOrder ? "Basket Price:" : "Price per share:"}
                    </span>
                    <span className="font-medium">
                      ₹{order.pricePerShare.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">Total Amount:</span>
                    <span className="text-lg font-bold text-primary">
                      ₹{order.totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Status & Date */}
                <div className="pt-4 border-t space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Date:</span>
                    <span className="font-medium text-xs">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed">
              A confirmation email will be sent to your registered email address.
              Our team will verify your payment and allocate shares shortly.
            </AlertDescription>
          </Alert>
        </div>

        {/* Actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose();
              router.push(`/thank-you?orderId=${order.orderNumber || order.id}`);
            }}
            className="w-full sm:w-auto"
          >
            Order Summary
          </Button>
          <Button
            onClick={handleContinueShopping}
            className="w-full sm:w-auto"
          >
            Continue Shopping
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
