import { ChevronLeft, Download, Sparkles, RefreshCcw, ShieldAlert } from 'lucide-react';

interface ReviewHeaderProps {
  recordCount: number;
  mode: string;
  hasErrors?: boolean;
  onBack: () => void;
  onReset: () => void;
  onDownloadBatch: () => void;
  onDownloadExcel: () => void;
}

const ReviewHeader: React.FC<ReviewHeaderProps> = ({
  recordCount,
  mode,
  hasErrors = false,
  onBack,
  onReset,
  onDownloadBatch,
  onDownloadExcel
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full text-emerald-600 text-[10px] font-black tracking-widest mb-3">
          <Sparkles className="w-3 h-3" />
          ANALYSIS_COMPLETE
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">
          Verify <span className="text-emerald-600">Records.</span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-slate-500 font-bold text-sm">
            <span className="text-slate-900">{recordCount}</span> Datasets successfully parsed and schema-aligned.
          </p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 w-full md:w-auto">
        <button
          onClick={onBack}
          className="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl transition-all flex items-center text-sm font-black tracking-widest shadow-sm"
        >
          <ChevronLeft className="w-4 h-4 mr-2" /> ADJUST
        </button>
        
        <button
          onClick={onReset}
          className="p-3.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl transition-all flex items-center justify-center shadow-sm"
          title="Reset Wizard"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>

        <button
          onClick={mode === 'batch-to-csv' ? onDownloadExcel : onDownloadBatch}
          disabled={hasErrors}
          className={`relative overflow-hidden group flex-1 md:flex-none px-8 py-3.5 rounded-2xl shadow-xl transition-all flex items-center justify-center text-sm font-black tracking-widest ${
            hasErrors
              ? 'bg-red-100 text-red-400 border border-red-200 shadow-none cursor-not-allowed'
              : 'bg-slate-900 text-white shadow-slate-900/10'
          }`}
          title={hasErrors ? 'Fix all validation errors before downloading' : ''}
        >
          {!hasErrors && (
            <div className="absolute inset-0 bg-linear-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <span className="relative z-10 flex items-center">
            {hasErrors ? (
              <>
                <ShieldAlert className="w-4 h-4 mr-2" />
                FIX_ERRORS
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {mode === 'batch-to-csv' ? 'EXPORT_EXCEL' : 'EXPORT_BATCH'}
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ReviewHeader;

