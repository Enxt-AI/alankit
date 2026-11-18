"use client";

/**
 * Payment Status Updater Component
 * 
 * Reusable component for updating payment status with confirmation dialog
 */

import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PaymentStatusOption {
  value: string;
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

interface PaymentStatusUpdaterProps {
  currentStatus: string;
  orderId: string;
  onUpdate: (newStatus: string) => Promise<void>;
  disabled?: boolean;
}

function getPaymentStatusVariant(status: string): PaymentStatusOption["variant"] {
  const statusLower = (status || "").toLowerCase();
  if (statusLower === "pending") return "outline";
  if (statusLower === "processing") return "secondary";
  if (statusLower === "paid") return "default";
  if (["failed", "user_dropped", "cancelled", "expired", "declined"].includes(statusLower)) return "destructive";
  return "outline";
}

const PAYMENT_STATUS_OPTIONS: PaymentStatusOption[] = [
  { value: "PENDING", label: "Pending", variant: "outline" },
  { value: "PROCESSING", label: "Processing", variant: "secondary" },
  { value: "PAID", label: "Paid", variant: "default" },
  { value: "FAILED", label: "Failed", variant: "destructive" },
  { value: "USER_DROPPED", label: "User Dropped", variant: "destructive" },
];

export function PaymentStatusUpdater({
  currentStatus,
  orderId,
  onUpdate,
  disabled = false,
}: PaymentStatusUpdaterProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setSelectedStatus(newStatus);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedStatus) return;

    setIsUpdating(true);
    try {
      await onUpdate(selectedStatus);
      setIsDialogOpen(false);
      setSelectedStatus(null);
    } catch (error) {
      // Error handling is done in the mutation hook
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setSelectedStatus(null);
  };

  const truncatedId = orderId.length > 8 ? `${orderId.slice(0, 8)}...` : orderId;

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant={getPaymentStatusVariant(currentStatus)}>
          {currentStatus}
        </Badge>
        
        <Select
          value=""
          onValueChange={handleStatusChange}
          disabled={disabled || isUpdating}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Update status..." />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment Status Update</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to update the payment status of order{" "}
                  <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">
                    {truncatedId}
                  </code>{" "}
                  from{" "}
                  <span className="font-semibold">{currentStatus}</span> to{" "}
                  <span className="font-semibold">{selectedStatus}</span>?
                </p>

                {selectedStatus === "PAID" && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                       This will mark the payment as successful and update the order status to PAID.
                    </p>
                  </div>
                )}

                {selectedStatus === "FAILED" && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                      This will mark the payment as failed. The order will remain in its current state.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={isUpdating}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
