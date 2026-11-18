import React from 'react';
import { DetailRecord } from '@/types/nsdl';
import ReviewTableRow from './ReviewTableRow';

interface ReviewTableProps {
  records: DetailRecord[];
  mode: string;
  hoveredRow: number | null;
  setHoveredRow: (idx: number | null) => void;
  editingCell: { rowIndex: number, field: keyof DetailRecord } | null;
  setEditingCell: (cell: { rowIndex: number, field: keyof DetailRecord } | null) => void;
  onCellEdit: (rowIndex: number, field: keyof DetailRecord, value: any) => void;
  onCellMouseEnter: (e: React.MouseEvent, field: string) => void;
  onCellMouseLeave: () => void;
  getRecordIssues: (record: DetailRecord, idx: number) => Array<{ field: string, message: string }>;
}

import { Layers } from 'lucide-react';

const ReviewTable: React.FC<ReviewTableProps> = ({
  records,
  mode,
  hoveredRow,
  setHoveredRow,
  editingCell,
  setEditingCell,
  onCellEdit,
  onCellMouseEnter,
  onCellMouseLeave,
  getRecordIssues
}) => {
  const tableHeaders = [
    'S.No', 'DP ID', 'Client ID', 'ISIN', 'Quantity', 'Consideration Amount', 
    'Transaction Date', 'Mode of Payment', 'Transferee Name', 'Bank Name', 'Account No', 'Transaction ID'
  ];

  return (
    <div className="relative bg-white/40 backdrop-blur-xl border border-white rounded-[32px] shadow-2xl shadow-emerald-950/5 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-emerald-500/20 to-transparent" />
      
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-50/50">
              {tableHeaders.map((header) => (
                <th key={header} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100/50">
                  <div className="flex items-center gap-2">
                    {header === 'S.No' && <Layers className="w-3 h-3 text-emerald-500/50" />}
                    {header}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {records.map((record, idx) => (
              <ReviewTableRow
                key={`${idx}-${record.isin}`}
                record={record}
                idx={idx}
                mode={mode}
                isHovered={hoveredRow === idx}
                anyRowHovered={hoveredRow !== null}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
                onCellMouseEnter={onCellMouseEnter}
                onCellMouseLeave={onCellMouseLeave}
                onCellEdit={onCellEdit}
                editingCell={editingCell}
                setEditingCell={setEditingCell}
                getRecordIssues={getRecordIssues}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewTable;
