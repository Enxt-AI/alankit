import React from 'react';
import { motion } from 'framer-motion';
import { BatchInfo } from '@/types/nsdl';

interface BatchInfoFormProps {
  batchInfo: BatchInfo;
  setBatchInfo: (info: BatchInfo) => void;
}

const BatchInfoForm: React.FC<BatchInfoFormProps> = ({ batchInfo, setBatchInfo }) => {
  const fields = [
    { label: 'Batch Number', key: 'batchNumber', placeholder: 'e.g. 1000080', maxLength: 7, hint: '7-digit numeric (auto zero-padded)', numericOnly: true },
    { label: 'Sender DP ID', key: 'dpId', placeholder: 'e.g. IN303655', maxLength: 8, hint: '8 characters', numericOnly: false },
    { label: 'Sender Client ID', key: 'clientId', placeholder: 'e.g. 10175310', maxLength: 8, hint: '8 characters', numericOnly: false }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
      {fields.map((field, i) => (
        <motion.div 
          key={field.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-linear-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity" />
          
          <div className="relative bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group-focus-within:border-emerald-200">
            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em]">
              {field.label}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                value={batchInfo[field.key as keyof BatchInfo]}
                onChange={(e) => {
                  let value = e.target.value;
                  // For batch number, strip non-numeric characters
                  if (field.numericOnly) {
                    value = value.replace(/\D/g, '');
                  }
                  setBatchInfo({...batchInfo, [field.key]: value});
                }}
                className="w-full bg-transparent py-1 text-slate-900 font-mono text-xl focus:outline-none placeholder:text-slate-200"
              />
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-50 overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: batchInfo[field.key as keyof BatchInfo] ? '0%' : '-100%' }}
                  className="w-full h-full bg-emerald-500"
                />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-300 font-medium tracking-wide">
              {field.hint}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default BatchInfoForm;

