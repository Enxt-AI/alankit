'use client';

import { useState, useEffect } from 'react';
import { notify } from '@/components/ui/floating-notification';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';
// NOTE: getAllRMs and MarketingRM imports removed -- RM system deprecated
// NOTE: useMarketingRMs hook import removed -- RM system deprecated
import type { CreateLeadDto, MarketingCampaign } from '@/lib/marketing-api';

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: MarketingCampaign[];
  onSubmit: (leadData: CreateLeadDto) => Promise<void>;
}

/**
 * Add Lead Dialog Component
 *
 * A dialog for creating new marketing leads with form validation
 * and campaign selection.
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback to control dialog open state
 * @param campaigns - Available marketing campaigns for selection
 * @param onSubmit - Callback to handle lead creation
 */
export default function AddLeadDialog({
  open,
  onOpenChange,
  campaigns,
  onSubmit,
}: AddLeadDialogProps) {
  // Form fields state
  const [campaignId, setCampaignId] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [status, setStatus] = useState<string>('NEW');
  // NOTE: assignedToRMId state removed -- RM system deprecated

  // Lead-table / popup schema fields (all optional, stored as metadata;
  // live user data wins over these whenever the lead matches a user)
  const [clientId, setClientId] = useState<string>('');
  const [kycStatus, setKycStatus] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [totalTransactionCount, setTotalTransactionCount] = useState<string>('');
  const [transactionCount, setTransactionCount] = useState<string>('');
  const [totalTransactionValue, setTotalTransactionValue] = useState<string>('');
  const [transactionValue, setTransactionValue] = useState<string>('');
  const [sharesRequested, setSharesRequested] = useState<string>('');
  const [lastShareName, setLastShareName] = useState<string>('');
  const [requestedShareNames, setRequestedShareNames] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NOTE: useMarketingRMs hook call removed -- RM system deprecated

  // Reset form fields when dialog opens
  useEffect(() => {
    if (open) {
      // Reset form fields
      setCampaignId('');
      setFullName('');
      setEmail('');
      setPhone('');
      setSource('');
      setStatus('NEW');
      setClientId('');
      setKycStatus('');
      setPaymentStatus('');
      setTotalTransactionCount('');
      setTransactionCount('');
      setTotalTransactionValue('');
      setTransactionValue('');
      setSharesRequested('');
      setLastShareName('');
      setRequestedShareNames('');
      // NOTE: setAssignedToRMId reset removed -- RM system deprecated
    }
  }, [open]);

  const parseNumber = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSubmit = async () => {
    // Validation (campaign + source are backend-required; name is mandatory)
    if (!campaignId.trim()) {
      notify.error('Please select a campaign');
      return;
    }

    if (!fullName.trim()) {
      notify.error('Please enter the lead name (mandatory)');
      return;
    }

    if (!source.trim()) {
      notify.error('Please select a source');
      return;
    }

    // Metadata mirrors the leads-table / popup schema so manually added
    // leads display the same columns until live user data takes over
    const metadata: Record<string, any> = {};
    if (clientId.trim()) metadata.clientId = clientId.trim();
    if (kycStatus) metadata.kycStatus = kycStatus;
    if (paymentStatus) metadata.paymentStatus = paymentStatus;
    const totalCount = parseNumber(totalTransactionCount);
    if (totalCount !== undefined) metadata.totalTransactionCount = totalCount;
    const successCount = parseNumber(transactionCount);
    if (successCount !== undefined) metadata.transactionCount = successCount;
    const totalValue = parseNumber(totalTransactionValue);
    if (totalValue !== undefined) metadata.totalTransactionValue = totalValue;
    const successValue = parseNumber(transactionValue);
    if (successValue !== undefined) metadata.transactionValue = successValue;
    const successShares = parseNumber(sharesRequested);
    if (successShares !== undefined) metadata.sharesRequested = successShares;
    if (lastShareName.trim()) metadata.lastShareName = lastShareName.trim();
    const requestedNames = requestedShareNames.split(',').map(s => s.trim()).filter(Boolean);
    if (requestedNames.length > 0) metadata.requestedShareNames = requestedNames;

    // Construct lead data
    const leadData: CreateLeadDto = {
      campaignId: campaignId.trim(),
      source: source.trim(),
      status: status as CreateLeadDto['status'],
      fullName: fullName.trim(),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    // Add optional fields if provided
    if (fullName.trim()) leadData.fullName = fullName.trim();
    if (email.trim()) leadData.email = email.trim();
    if (phone.trim()) leadData.phone = phone.trim();
    // NOTE: assignedToRMId conditional add removed -- RM system deprecated

    try {
      setIsSubmitting(true);
      await onSubmit(leadData);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create lead:', error);
      const errorMessage = (error as Error)?.message || 'Failed to create lead';
      notify.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl border border-neutral-200/40 bg-white shadow-lg sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><UserPlus className="h-4 w-4" /></span>Add New Lead</DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">Create a new marketing lead for tracking.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Campaign Selection */}
          <div className="space-y-2">
            <Label htmlFor="campaign" className="text-sm font-semibold text-[#0F172A]">
              Campaign (Required)
            </Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-neutral-200/40">
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name} ({campaign.platform})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-semibold text-[#0F172A]">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting}
              className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-[#0F172A]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold text-[#0F172A]">
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
              className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* Client ID */}
          <div className="space-y-2">
            <Label htmlFor="clientId" className="text-sm font-semibold text-[#0F172A]">
              Client ID
            </Label>
            <Input
              id="clientId"
              type="text"
              placeholder="Client ID (optional)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isSubmitting}
              className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* KYC Status */}
          <div className="space-y-2">
            <Label htmlFor="kycStatus" className="text-sm font-semibold text-[#0F172A]">
              KYC Status
            </Label>
            <Select value={kycStatus} onValueChange={setKycStatus}>
              <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                <SelectValue placeholder="Select KYC status (optional)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-neutral-200/40">
                <SelectItem value="NOT_INITIATED">Not Initiated</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="NOT_VERIFIED">Not Verified</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Last Payment Status */}
          <div className="space-y-2">
            <Label htmlFor="paymentStatus" className="text-sm font-semibold text-[#0F172A]">
              Last Payment Status
            </Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                <SelectValue placeholder="Select payment status (optional)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-neutral-200/40">
                <SelectItem value="NA">NA</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transaction counts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="totalTransactionCount" className="text-sm font-semibold text-[#0F172A]">
                Total Txn Count
              </Label>
              <Input
                id="totalTransactionCount"
                type="number"
                min="0"
                placeholder="0"
                value={totalTransactionCount}
                onChange={(e) => setTotalTransactionCount(e.target.value)}
                disabled={isSubmitting}
                className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transactionCount" className="text-sm font-semibold text-[#0F172A]">
                Successful Txn Count
              </Label>
              <Input
                id="transactionCount"
                type="number"
                min="0"
                placeholder="0"
                value={transactionCount}
                onChange={(e) => setTransactionCount(e.target.value)}
                disabled={isSubmitting}
                className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
              />
            </div>
          </div>

          {/* Transaction values */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="totalTransactionValue" className="text-sm font-semibold text-[#0F172A]">
                Total Txn Value (₹)
              </Label>
              <Input
                id="totalTransactionValue"
                type="number"
                min="0"
                placeholder="0"
                value={totalTransactionValue}
                onChange={(e) => setTotalTransactionValue(e.target.value)}
                disabled={isSubmitting}
                className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transactionValue" className="text-sm font-semibold text-[#0F172A]">
                Successful Txn Value (₹)
              </Label>
              <Input
                id="transactionValue"
                type="number"
                min="0"
                placeholder="0"
                value={transactionValue}
                onChange={(e) => setTransactionValue(e.target.value)}
                disabled={isSubmitting}
                className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
              />
            </div>
          </div>

          {/* Successful Shares */}
          <div className="space-y-2">
            <Label htmlFor="sharesRequested" className="text-sm font-semibold text-[#0F172A]">
              Successful Shares
            </Label>
            <Input
              id="sharesRequested"
              type="number"
              min="0"
              placeholder="0"
              value={sharesRequested}
              onChange={(e) => setSharesRequested(e.target.value)}
              disabled={isSubmitting}
              className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* Last Share */}
          <div className="space-y-2">
            <Label htmlFor="lastShareName" className="text-sm font-semibold text-[#0F172A]">
              Last Share
            </Label>
            <Input
              id="lastShareName"
              type="text"
              placeholder="Share / basket name (optional)"
              value={lastShareName}
              onChange={(e) => setLastShareName(e.target.value)}
              disabled={isSubmitting}
              className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* Shares Requested (names) */}
          <div className="space-y-2">
            <Label htmlFor="requestedShareNames" className="text-sm font-semibold text-[#0F172A]">
              Shares Requested (Names)
            </Label>
            <Input
              id="requestedShareNames"
              type="text"
              placeholder="Comma-separated share names (optional)"
              value={requestedShareNames}
              onChange={(e) => setRequestedShareNames(e.target.value)}
              disabled={isSubmitting}
              className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          {/* Source Selection */}
          <div className="space-y-2">
            <Label htmlFor="source" className="text-sm font-semibold text-[#0F172A]">
              Source (Required)
            </Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                <SelectValue placeholder="Select a source" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-neutral-200/40">
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="GOOGLE">Google</SelectItem>
                <SelectItem value="TWITTER">Twitter</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-semibold text-[#0F172A]">
              Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-neutral-200/40">
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="QUALIFIED">Qualified</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Empty campaigns warning */}
          {campaigns.length === 0 && (
            <div className="text-xs font-semibold text-yellow-700 bg-yellow-50 p-3 rounded-xl border border-yellow-200/50">
              No campaigns available. Please create a campaign first.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting} className="h-10 px-4 rounded-lg font-semibold">
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || campaigns.length === 0} className="h-10 px-4 rounded-lg font-semibold bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Lead'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}