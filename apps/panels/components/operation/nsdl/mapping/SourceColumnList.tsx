import React from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet } from 'lucide-react';
import { ExcelColumn } from '@/types/nsdl';

interface SourceColumnListProps {
  excelColumns: ExcelColumn[];
  onDragStart: (e: React.DragEvent, column: ExcelColumn) => void;
}

const SourceColumnList: React.FC<SourceColumnListProps> = ({ excelColumns, onDragStart }) => {
  return (
    <div className="lg:col-span-4 bg-white/40 backdrop-blur-xl rounded-[32px] p-8 border border-white shadow-xl shadow-emerald-950/5 h-fit sticky top-8">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full text-emerald-600 text-[10px] font-black tracking-widest mb-6 border border-emerald-100/50">
        <FileSpreadsheet className="w-3 h-3" />
        DATA SOURCES
      </div>
      
      <h4 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
        Available <span className="text-emerald-600">Columns</span>
      </h4>

      <p className="text-xs font-medium text-slate-400 mb-8 leading-relaxed">
        Drag these parameters into the schema fields to establish the mapping logic.
      </p>

      <div className="flex flex-col gap-3">
        {excelColumns.map((column) => (
          <motion.div
            key={column.id}
            draggable
            onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, column)}
            whileHover={{ x: 5, backgroundColor: '#ffffff' }}
            whileTap={{ scale: 0.98 }}
            className="group px-4 py-4 bg-white/50 border border-slate-100 text-slate-700 rounded-2xl cursor-grab active:cursor-grabbing text-sm flex items-center font-bold shadow-sm hover:border-emerald-200 hover:text-emerald-700 transition-all"
          >
            <div className="mr-4 text-slate-300 group-hover:text-emerald-400 transition-colors">
              <span className="block leading-none h-1 w-1 rounded-full bg-current mb-0.5" />
              <span className="block leading-none h-1 w-1 rounded-full bg-current mb-0.5" />
              <span className="block leading-none h-1 w-1 rounded-full bg-current" />
            </div>
            <span className="tracking-tight">{column.name}</span>
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SourceColumnList;
