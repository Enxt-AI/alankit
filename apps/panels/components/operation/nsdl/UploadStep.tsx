import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { useNSDLStore } from '@/store/nsdl-store';

interface UploadStepProps {
  onFileUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  error?: string | null;
}

const UploadStep: React.FC<UploadStepProps> = ({ 
  onFileUpload: propFileUpload, 
  loading: propLoading, 
  error: propError 
}) => {
  const store = useNSDLStore();

  const onFileUpload = propFileUpload || store.handleFileUpload;
  const loading = propLoading !== undefined ? propLoading : store.loading;
  const error = propError !== undefined ? propError : store.error;

  return (
    <div className="p-6 md:p-10 flex flex-col items-center w-full">
      <motion.div
        key="file-mode"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white border border-neutral-200/40 rounded-[24px] p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
      >
        <label className={`
          relative flex flex-col items-center justify-center w-full h-48 
          bg-neutral-50/50 hover:bg-[#ECFDF5]/10 rounded-xl border-2 border-dashed 
          transition-all duration-300 cursor-pointer overflow-hidden
          ${loading ? 'border-[#16A34A] bg-[#ECFDF5]/10' : 'border-neutral-200 hover:border-[#16A34A]'}
        `}>
          <input 
            type="file" 
            className="hidden" 
            onChange={onFileUpload} 
            disabled={loading} 
            accept=".xlsx,.xls,.csv,.txt"
          />
          
          {loading ? (
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 mb-4">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-0 border-4 border-neutral-200 border-t-[#16A34A] rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-[#16A34A]" />
                </div>
              </div>
              <p className="text-[#16A34A] font-bold tracking-wider text-xs animate-pulse">ANALYZING DATA...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center p-6 text-center">
              <div className="w-12 h-12 mb-3 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#16A34A] transition-transform duration-300 shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-lg font-bold text-[#0F172A] mb-1">Drag & drop or <span className="text-[#16A34A]">click</span> to upload</p>
              <p className="text-[#64748B] text-xs font-medium">Supported formats: .xlsx, .xls, .csv, .txt</p>
            </div>
          )}
        </label>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 flex items-center gap-3 px-4 py-3 bg-[#FEF2F2] border border-[#FEF2F2]/20 rounded-xl text-[#DC2626] shadow-sm max-w-2xl w-full"
          >
            <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
            <p className="font-semibold text-xs tracking-tight">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info icons footer */}
      <div className="mt-8 flex gap-8 opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-500 shadow-xs">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider">Excel Sync</p>
            <p className="text-[9px] text-[#64748B] font-medium">Direct .xlsx parsing</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-500 shadow-xs">
             <div className="font-mono text-[9px] font-bold leading-none">TXT</div>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider">NSDL batch</p>
            <p className="text-[9px] text-[#64748B] font-medium">Standard SPEED output</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadStep;

