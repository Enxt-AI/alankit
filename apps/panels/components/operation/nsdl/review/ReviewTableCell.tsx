import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { DetailRecord } from '@/types/nsdl';

interface ReviewTableCellProps {
  value: any;
  field: keyof DetailRecord;
  rowIndex: number;
  issue: string | undefined;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const ReviewTableCell: React.FC<ReviewTableCellProps> = ({
  value,
  field,
  rowIndex,
  issue,
  isEditing,
  onEdit,
  onSave,
  onMouseEnter,
  onMouseLeave
}) => {
  return (
    <td 
      className={`px-6 py-4 text-xs whitespace-nowrap transition-all duration-300 relative group/cell ${
        issue ? 'bg-red-50/10' : ''
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center min-h-[24px]">
        {isEditing ? (
          <div className="relative w-full">
            <input
              autoFocus
              className="w-full bg-white border-2 border-emerald-500 rounded-xl px-3 py-1.5 outline-none shadow-xl shadow-emerald-500/20 font-mono text-xs font-black text-emerald-900"
              defaultValue={value !== null && value !== undefined ? String(value) : ''}
              onBlur={(e) => onSave(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave(e.currentTarget.value);
                if (e.key === 'Escape') onSave(value !== null && value !== undefined ? String(value) : '');
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
              <Check className="w-3 h-3 text-emerald-500" />
            </div>
          </div>
        ) : (
          <div 
            onClick={onEdit}
            className={`cursor-pointer w-full flex items-center justify-between group/content ${
              issue ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            <span className={`font-mono font-bold tracking-tight transition-all ${
              issue 
                ? 'decoration-red-300 underline underline-offset-4 decoration-dashed' 
                : 'group-hover/cell:text-emerald-600'
            }`}>
              {(value !== null && value !== undefined && String(value) !== '') ? String(value) : '—'}
            </span>
            
            {issue ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 opacity-60 group-hover/content:opacity-100 transition-opacity" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 scale-0 group-hover/cell:scale-100 transition-transform duration-300" />
            )}
          </div>
        )}
      </div>
    </td>
  );
};

export default ReviewTableCell;
