import React, { useMemo } from 'react';
import { DetailRecord, ParsedData, TooltipState } from '@/types/nsdl';
import { getRecordIssues } from '@/lib/nsdl-validator';
import ReviewHeader from './ReviewHeader';
import ValidationBanner from './ValidationBanner';
import ReviewTable from './ReviewTable';
import { useNSDLStore } from '@/store/nsdl-store';

interface ReviewStepProps {
  parsedData?: ParsedData;
  mode?: string;
  onDownloadExcel?: () => void;
  onDownloadBatchFile?: () => void;
  onReset?: () => void;
  onBack?: () => void;
  onCellEdit?: (rowIndex: number, field: keyof DetailRecord, value: any) => void;
  tooltip?: TooltipState;
  setTooltip?: (tooltip: TooltipState) => void;
  hoveredRow?: number | null;
  setHoveredRow?: (idx: number | null) => void;
  editingCell?: { rowIndex: number, field: keyof DetailRecord } | null;
  setEditingCell?: (cell: { rowIndex: number, field: keyof DetailRecord } | null) => void;
}

const ReviewStep: React.FC<ReviewStepProps> = (props) => {
  const store = useNSDLStore();
  
  // Merge props with store values
  const parsedData = props.parsedData || store.parsedData;
  const mode = props.mode || store.mode;
  const onDownloadExcel = props.onDownloadExcel || store.handleDownloadExcel;
  const onDownloadBatchFile = props.onDownloadBatchFile || store.handleDownloadBatch;
  const onReset = props.onReset || store.resetWizard;
  const onBack = props.onBack || (() => {
    if (store.dataSourceMode === 'file' && mode === 'excel-to-batch') {
      store.setShowExcelMapping(true);
      store.setCurrentStep(2);
    } else {
      store.setCurrentStep(1);
    }
  });
  const onCellEdit = props.onCellEdit || store.handleCellEdit;
  const tooltip = props.tooltip || store.tooltip;
  const setTooltip = props.setTooltip || store.setTooltip;
  const hoveredRow = props.hoveredRow !== undefined ? props.hoveredRow : store.hoveredRow;
  const setHoveredRow = props.setHoveredRow || store.setHoveredRow;
  const editingCell = props.editingCell !== undefined ? props.editingCell : store.editingCell;
  const setEditingCell = props.setEditingCell || store.setEditingCell;

  const allIssues = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.detailRecords.flatMap((record, idx) => {
      const issues = getRecordIssues(record, idx);
      return issues.map(issue => ({
        ...issue,
        row: idx + 1
      }));
    });
  }, [parsedData]);

  if (!parsedData) return null;

  const handleCellMouseEnter = (e: React.MouseEvent, field: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      content: `Editing ${field}`
    });
  };

  const handleCellMouseLeave = () => {
    setTooltip({ ...tooltip, visible: false });
  };

  return (
    <div className="p-6 md:p-10 bg-slate-50/50">
      <ReviewHeader 
        recordCount={parsedData.detailRecords.length}
        mode={mode}
        hasErrors={allIssues.length > 0}
        onBack={onBack}
        onReset={onReset}
        onDownloadBatch={onDownloadBatchFile}
        onDownloadExcel={onDownloadExcel}
      />

      <ValidationBanner allIssues={allIssues} />

      <ReviewTable 
        records={parsedData.detailRecords}
        mode={mode}
        hoveredRow={hoveredRow}
        setHoveredRow={setHoveredRow}
        editingCell={editingCell}
        setEditingCell={setEditingCell}
        onCellEdit={onCellEdit}
        onCellMouseEnter={handleCellMouseEnter}
        onCellMouseLeave={handleCellMouseLeave}
        getRecordIssues={getRecordIssues}
      />
    </div>
  );
};

export default ReviewStep;
