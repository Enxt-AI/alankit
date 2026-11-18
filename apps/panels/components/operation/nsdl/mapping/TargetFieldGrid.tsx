import React from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, CheckCircle, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { ExcelColumn } from '@/types/nsdl';

interface TargetFieldGridProps {
  columnMapping: Record<string, ExcelColumn>;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, field: string) => void;
  removeMapping: (field: string) => void;
}

const TargetFieldGrid: React.FC<TargetFieldGridProps> = ({
  columnMapping,
  onDragOver,
  onDrop,
  removeMapping
}) => {
  const targetFields = [
    { name: 'ISIN', required: true, desc: 'Securities Identifier' },
    { name: 'Quantity', required: true, desc: 'Units for transfer' },
    { name: 'Recipient DP ID', required: false, mappingKey: 'DP ID', desc: '8-char ID' },
    { name: 'Recipient Client ID', required: false, mappingKey: 'Client ID', desc: '8-digit ID' },
    { name: 'Consideration Amount', required: false, desc: 'Payment Value' },
    { name: 'Mode of Payment', required: false, desc: 'e.g. UPI/NetBanking' },
    { name: 'Date of Receipt', required: false, desc: 'DD-MM-YYYY' },
    { name: 'Transferee Name', required: false, desc: 'Receiver Full Name' },
    { name: 'Bank Name', required: false, desc: 'Financial Institution' },
    { name: 'Bank Account Number', required: false, desc: 'Receiver Account' },
    { name: 'Transaction/Cheque ID', required: false, desc: 'Reference No.' }
  ];

  return (
    <div className="lg:col-span-8 flex flex-col gap-6">
       <div className="flex items-center gap-2 mb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-full text-teal-600 text-[10px] font-black tracking-widest border border-teal-100/50">
          <ShieldCheck className="w-3 h-3" />
          SCHEMA_MAPPING
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {targetFields.map((field, idx) => {
          const mappingKey = field.mappingKey || field.name;
          const isMapped = !!columnMapping[mappingKey];
          
          return (
            <motion.div 
              key={field.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, mappingKey)}
              className={`group relative p-6 rounded-[24px] border-2 border-dashed transition-all duration-500 overflow-hidden ${
                isMapped
                  ? 'border-emerald-500/30 bg-emerald-50/20 shadow-lg shadow-emerald-500/5'
                  : 'border-slate-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-xl'
              }`}
            >
              {/* Slot Background Decoration */}
              <div className={`absolute top-0 right-0 p-4 opacity-[0.03] transition-opacity duration-500 ${isMapped ? 'opacity-[0.1]' : ''}`}>
                <CheckCircle className={`w-20 h-20 ${isMapped ? 'text-emerald-500' : 'text-slate-300'}`} />
              </div>

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h5 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      {field.name}
                      {field.required && <span className="text-red-500 text-[10px] animate-pulse">●</span>}
                    </h5>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                      {field.desc}
                    </p>
                  </div>
                  
                  {isMapped && (
                    <motion.button
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => removeMapping(mappingKey)}
                      className="p-1.5 bg-white rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all shadow-sm border border-slate-100"
                    >
                      <X className="w-3 h-3" />
                    </motion.button>
                  )}
                </div>
                
                <div className="mt-4">
                  {isMapped ? (
                    <motion.div 
                      layoutId={`mapping-${field.name}`}
                      className="px-4 py-3 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-600/30 flex items-center justify-between group/pill"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-200" />
                        <span className="text-xs font-black truncate tracking-tighter uppercase">{columnMapping[mappingKey]?.name}</span>
                      </div>
                      <ShieldCheck className="w-3 h-3 text-emerald-400 opacity-0 group-hover/pill:opacity-100 transition-opacity" />
                    </motion.div>
                  ) : (
                    <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-xs font-bold tracking-tighter flex items-center justify-center border-dashed group-hover:bg-white group-hover:border-emerald-200 group-hover:text-emerald-500 transition-all">
                      DRAG_COLUMN_HERE
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default TargetFieldGrid;
