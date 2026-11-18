import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MappingHeaderProps {
  onBack: () => void;
  onContinue: () => void;
}

const MappingHeader: React.FC<MappingHeaderProps> = ({ onBack, onContinue }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-slate-500 text-[10px] font-black tracking-widest mb-3">
          STEP_02
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">
          Configure <span className="text-emerald-600">Schema.</span>
        </h2>
        <p className="text-slate-500 font-medium italic">Establishing bidirectional mapping between Excel and NSDL format.</p>
      </div>
      
      <div className="flex gap-4 w-full md:w-auto">
        <button
          onClick={onBack}
          className="flex-1 md:flex-none px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl transition-all flex items-center justify-center text-sm font-black tracking-widest shadow-sm"
        >
          <ChevronLeft className="w-4 h-4 mr-2" /> DISCARD
        </button>
        <button
          onClick={onContinue}
          className="flex-1 md:flex-none relative overflow-hidden group px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-900/10 transition-all flex items-center justify-center text-sm font-black tracking-widest"
        >
          <div className="absolute inset-0 bg-linear-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative z-10 flex items-center">
            FINALIZE <ChevronRight className="w-4 h-4 ml-2" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default MappingHeader;
