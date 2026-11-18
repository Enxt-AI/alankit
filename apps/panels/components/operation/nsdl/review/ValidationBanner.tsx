import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ShieldAlert, Info } from 'lucide-react';

interface ValidationError {
  field: string;
  message: string;
  row: number;
}

interface ValidationBannerProps {
  allIssues: ValidationError[];
}

const ValidationBanner: React.FC<ValidationBannerProps> = ({ allIssues }) => {
  if (allIssues.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-50/50 border border-emerald-100 rounded-[24px] p-6 mb-12 flex items-center gap-4"
      >
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-50">
          <Info className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-black text-emerald-900 tracking-tight">SCHEMA_VALIDATED</h3>
          <p className="text-xs font-medium text-emerald-700/70">All data records are structurally sound and ready for export.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-red-50/50 border border-red-100 rounded-[32px] p-8 mb-12 relative overflow-hidden shadow-xl shadow-red-950/5"
    >
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <ShieldAlert className="w-32 h-32 text-red-500" />
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-[20px] flex items-center justify-center text-red-500 shadow-sm border border-red-50">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-red-900 tracking-tight">Validation Breach</h3>
            <p className="text-xs font-bold text-red-700/60 uppercase tracking-widest">{allIssues.length} CRITICAL_ANOMALIES_DETECTED</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10 max-h-60 overflow-y-auto pr-4 custom-scrollbar">
        {allIssues.map((issue, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-red-100/50 hover:border-red-300 transition-all flex flex-col gap-2"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-lg tracking-widest">ROW_{issue.row}</span>
              <span className="text-[10px] font-black text-red-900/40 uppercase tracking-widest">{issue.field}</span>
            </div>
            <p className="text-xs font-bold text-red-800 leading-snug">{issue.message}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ValidationBanner;
