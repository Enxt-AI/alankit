import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface ConvertConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConvertConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ConvertConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-3xl border border-neutral-200 bg-white shadow-2xl p-6 overflow-hidden max-w-md">
        <AlertDialogHeader className="pb-2">
          <AlertDialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#16A34A]" />
            Convert Upcoming Stock
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-medium text-[#64748B] mt-1">
            This action is irreversible. Convert this upcoming stock to a regular stock?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-3 gap-2 sm:gap-0">
          <AlertDialogCancel 
            disabled={isLoading}
            className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 outline-none"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
          >
            {isLoading ? 'Converting...' : 'Convert'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
