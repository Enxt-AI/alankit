import React from 'react';
import { ExcelColumn, BatchInfo } from '@/types/nsdl';
import MappingHeader from './MappingHeader';
import BatchInfoForm from './BatchInfoForm';
import SourceColumnList from './SourceColumnList';
import TargetFieldGrid from './TargetFieldGrid';
import { useNSDLStore } from '@/store/nsdl-store';

interface MappingStepProps {
  excelColumns?: ExcelColumn[];
  columnMapping?: Record<string, ExcelColumn>;
  batchInfo?: BatchInfo;
  setBatchInfo?: (info: BatchInfo) => void;
  onDragStart?: (e: React.DragEvent, column: ExcelColumn) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, field: string) => void;
  removeMapping?: (field: string) => void;
  onContinue?: () => void;
  onBack?: () => void;
}

const MappingStep: React.FC<MappingStepProps> = (props) => {
  const store = useNSDLStore();
  
  // Merge props with store values
  const excelColumns = props.excelColumns || store.excelColumns;
  const columnMapping = props.columnMapping || store.columnMapping;
  const batchInfo = props.batchInfo || store.batchInfo;
  const setBatchInfo = props.setBatchInfo || store.setBatchInfo;
  const onDragOver = props.onDragOver || ((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  const onContinue = props.onContinue || store.convertExcelToCSV;
  const onBack = props.onBack || (() => { store.setCurrentStep(1); });
  
  const onDragStart = props.onDragStart || ((e, col) => {
    e.dataTransfer.setData('column', JSON.stringify(col));
    e.dataTransfer.effectAllowed = 'move';
  });

  const onDrop = props.onDrop || ((e, field) => {
    e.preventDefault();
    const column = JSON.parse(e.dataTransfer.getData('column'));
    store.setColumnMapping(prev => ({ ...prev, [field]: column }));
  });

  const removeMapping = props.removeMapping || ((field) => {
    store.setColumnMapping(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  });
  return (
    <div className="p-6 md:p-8 bg-slate-50/50">
      <MappingHeader onBack={onBack} onContinue={onContinue} />
      
      <BatchInfoForm batchInfo={batchInfo} setBatchInfo={setBatchInfo} />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <SourceColumnList excelColumns={excelColumns} onDragStart={onDragStart} />
        <TargetFieldGrid 
          columnMapping={columnMapping}
          onDragOver={onDragOver}
          onDrop={onDrop}
          removeMapping={removeMapping}
        />
      </div>
    </div>
  );
};

export default MappingStep;
