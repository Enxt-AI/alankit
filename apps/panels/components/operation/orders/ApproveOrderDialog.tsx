import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { OrderWithDetails } from '@/types/order';

interface ApproveOrderDialogProps {
  order: OrderWithDetails;
  onApprove: (shareTransferReferenceNo: string, shareTransferDate: string, batchSequence: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ApproveOrderDialog({ order, onApprove, isSubmitting }: ApproveOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [shareTransferReferenceNo, setShareTransferReferenceNo] = useState('');
  const [shareTransferDate, setShareTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchSequence, setBatchSequence] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTransferReferenceNo.trim() || !shareTransferDate || !batchSequence.trim()) return;
    
    await onApprove(shareTransferReferenceNo.trim(), shareTransferDate, batchSequence.trim());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm" 
          className="bg-[#16A34A] border border-[#16A34A] text-white hover:bg-[#15803D] active:scale-[0.98] transition-all rounded-md font-semibold text-xs px-2.5 h-7 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
        >
          Approve Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-[24px] bg-white border border-neutral-200/40 p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#0F172A]">Approve Order</DialogTitle>
            <DialogDescription className="text-xs font-medium text-[#64748B] mt-1">
              Enter the share transfer details to finalize order #{order.id.slice(-10).toUpperCase()} and generate the Sales Voucher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shareTransferReferenceNo" className="text-xs font-bold text-[#0F172A]">
                Transfer Referance No.
              </Label>
              <Input
                id="shareTransferReferenceNo"
                value={shareTransferReferenceNo}
                onChange={(e) => setShareTransferReferenceNo(e.target.value)}
                placeholder="e.g. REF12345678"
                className="w-full rounded-xl border border-neutral-200/60 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] outline-none transition-all h-10 px-3 bg-white text-[#0F172A] placeholder:text-[#64748B]/40 text-sm"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shareTransferDate" className="text-xs font-bold text-[#0F172A]">
                Transfer Date
              </Label>
              <DatePicker
                value={shareTransferDate}
                onChange={(val) => setShareTransferDate(val)}
                className="w-full rounded-xl border border-neutral-200/60 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] outline-none transition-all h-10 px-3 bg-white text-[#0F172A] text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batchSequence" className="text-xs font-bold text-[#0F172A]">
                Batch Sequence
              </Label>
              <Input
                id="batchSequence"
                required
                value={batchSequence}
                onChange={(e) => setBatchSequence(e.target.value)}
                placeholder="e.g. BATCH-001"
                className="w-full rounded-xl border border-neutral-200/60 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] outline-none transition-all h-10 px-3 bg-white text-[#0F172A] placeholder:text-[#64748B]/40 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end pt-2 border-t border-neutral-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] active:scale-[0.98] transition-all duration-300 rounded-full font-semibold text-xs px-4 h-9"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !shareTransferReferenceNo.trim() || !shareTransferDate || !batchSequence.trim()}
              className="bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:border-[#16A34A] hover:text-[#0F172A] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-full font-bold text-xs px-4 h-9"
            >
              {isSubmitting ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
