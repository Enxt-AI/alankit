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

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isLoading = false,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-3xl border border-neutral-200 bg-white shadow-2xl p-6 overflow-hidden max-w-md">
        <AlertDialogHeader className="pb-2">
          <AlertDialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-medium text-[#64748B] mt-1">{description}</AlertDialogDescription>
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
            className="h-10 bg-red-600 text-white border-2 border-red-600 hover:bg-white hover:text-red-600 hover:border-red-600 hover:shadow-[0_8px_20px_rgba(220,38,38,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
