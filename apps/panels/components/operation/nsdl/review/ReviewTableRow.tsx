import React from 'react';
import { motion } from 'framer-motion';
import { DetailRecord } from '@/types/nsdl';
import ReviewTableCell from './ReviewTableCell';

interface ReviewTableRowProps {
  record: DetailRecord;
  idx: number;
  mode: string;
  isHovered: boolean;
  anyRowHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCellMouseEnter: (e: React.MouseEvent, field: string) => void;
  onCellMouseLeave: () => void;
  onCellEdit: (rowIndex: number, field: keyof DetailRecord, value: any) => void;
  editingCell: { rowIndex: number, field: keyof DetailRecord } | null;
  setEditingCell: (cell: { rowIndex: number, field: keyof DetailRecord } | null) => void;
  getRecordIssues: (record: DetailRecord, idx: number) => Array<{ field: string, message: string }>;
}

const ReviewTableRow: React.FC<ReviewTableRowProps> = ({
  record,
  idx,
  mode,
  isHovered,
  anyRowHovered,
  onMouseEnter,
  onMouseLeave,
  onCellMouseEnter,
  onCellMouseLeave,
  onCellEdit,
  editingCell,
  setEditingCell,
  getRecordIssues
}) => {
  const issues = getRecordIssues(record, idx);
  const detailFields: (keyof DetailRecord)[] = [
    'dpId', 'clientId', 'isin', 'quantity', 'considerationAmount', 
    'dateOfPayment', 'modeOfPayment', 'transfereeName', 'bankName', 
    'bankAccountNumber', 'transactionId'
  ];

  return (
    <motion.tr 
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group/row transition-all duration-500 border-b border-slate-50 last:border-0 ${
        isHovered 
          ? 'bg-emerald-50/30' 
          : anyRowHovered ? 'opacity-30 grayscale-[0.5]' : ''
      }`}
    >
      <td className="px-6 py-4 text-[10px] font-black text-slate-400 font-mono italic">
        {String(idx + 1).padStart(3, '0')}
      </td>
      {detailFields.map((field) => (
        <ReviewTableCell
          key={field}
          value={record[field]}
          field={field}
          rowIndex={idx}
          issue={issues.find(i => i.field === field)?.message}
          isEditing={editingCell?.rowIndex === idx && editingCell?.field === field}
          onEdit={() => setEditingCell({ rowIndex: idx, field })}
          onSave={(val) => {
            onCellEdit(idx, field, val);
            setEditingCell(null);
          }}
          onMouseEnter={(e) => onCellMouseEnter(e, field)}
          onMouseLeave={onCellMouseLeave}
        />
      ))}
    </motion.tr>
  );
};

export default ReviewTableRow;
