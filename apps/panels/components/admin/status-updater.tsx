"use client";

/**
 * Status Updater Component
 * 
 * Reusable component for updating order or referral status
 * Includes confirmation dialog and optional amount input for referrals
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { notify } from "@/components/ui/floating-notification";

/**
 * Status option configuration
 */
interface StatusOption {
  value: string;
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

/**
 * StatusUpdater Props
 */
interface StatusUpdaterProps {
  /** Current status value */
  currentStatus: string;
  /** Available status options with optional badge variants */
  statusOptions: StatusOption[];
  /** Callback for status update with optional additional data */
  onUpdate: (newStatus: string, additionalData?: any) => Promise<void>;
  /** Disable dropdown if no permission */
  disabled?: boolean;
  /** Type for confirmation message */
  entityType: "order" | "referral";
  /** ID for display in confirmation */
  entityId: string;
  /** Show reward amount input for referrals */
  showAmountInput?: boolean;
  /** Current reward amount for referrals */
  currentAmount?: number;
}

/**
 * Get badge variant based on status
 */
function getStatusVariant(status: string): StatusOption["variant"] {
  const statusLower = status.toLowerCase();
  if (statusLower === "pending") return "outline";
  if (statusLower === "completed") return "default";
  return "secondary";
}

export function StatusUpdater({
  currentStatus,
  statusOptions,
  onUpdate,
  disabled = false,
  entityType,
  entityId,
  showAmountInput = false,
  currentAmount,
}: StatusUpdaterProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [amountOverride, setAmountOverride] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    // For referrals with action-based dropdown, allow selecting the same status
    // (e.g., PARTIALLY_PAID means "Process Payment", not changing status)
    // For orders, prevent selecting the same status (no-op)
    if (entityType === 'order' && newStatus === currentStatus) return;
    
    setSelectedStatus(newStatus);
    setAmountOverride(currentAmount?.toString() || "");
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedStatus) return;

    // Validate amount override if provided
    if (showAmountInput && amountOverride) {
      const amount = parseFloat(amountOverride);
      if (isNaN(amount)) {
        notify.error("Please enter a valid number for reward amount");
        return;
      }
      if (amount < 0) {
        notify.error("Reward amount cannot be negative");
        return;
      }
    }

    setIsUpdating(true);
    try {
      let additionalData = undefined;
      
      if (showAmountInput && amountOverride) {
        const amount = parseFloat(amountOverride);
        additionalData = { rewardAmount: amount };
      }

      await onUpdate(selectedStatus, additionalData);
      setIsDialogOpen(false);
      setSelectedStatus(null);
      setAmountOverride("");
    } catch (error) {
      // Error handling is done in the mutation hook
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setSelectedStatus(null);
    setAmountOverride("");
  };

  const truncatedId = entityId.length > 8 ? `${entityId.slice(0, 8)}...` : entityId;

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant={getStatusVariant(currentStatus)}>
          {currentStatus}
        </Badge>
        
        {statusOptions.length > 0 && (
          <Select
            value=""
            onValueChange={handleStatusChange}
            disabled={disabled || isUpdating}
          >
            <SelectTrigger className="w-[210px]">
              <SelectValue placeholder="Select action..." />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {/* Referral payment processing message */}
                {entityType === "referral" && selectedStatus === "PARTIALLY_PAID" && (
                  <p>
                    Process payment of{" "}
                    <span className="font-semibold text-green-600">₹{currentAmount?.toFixed(2) || "0.00"}</span>{" "}
                    to the referrer for {entityType} {" "}
                    <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">
                      {truncatedId}
                    </code>?
                  </p>
                )}

                {/* Default status update message for non-payment referrals and orders */}
                {!(entityType === "referral" && selectedStatus === "PARTIALLY_PAID") && (
                  <p>
                    Are you sure you want to update the status of {entityType} {" "}
                    <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">
                      {truncatedId}
                    </code> from{" "}
                    <span className="font-semibold">{currentStatus}</span> to{" "}
                    <span className="font-semibold">{selectedStatus}</span>?
                  </p>
                )}

                {entityType === "order" && selectedStatus === "COMPLETED" && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                      ⚠️ Warning: Once completed, this order cannot be reverted or modified.
                    </p>
                  </div>
                )}

                {showAmountInput && (
                  <div className="space-y-2">
                    <Label htmlFor="amount-override">
                      Reward Amount Override (₹)
                    </Label>
                    <Input
                      id="amount-override"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`Current: ₹${currentAmount?.toFixed(2) || "0.00"}`}
                      value={amountOverride}
                      onChange={(e) => setAmountOverride(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to keep calculated reward amount
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
