import { create } from 'zustand';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';

// Types
import { 
  DetailRecord, 
  ParsedData, 
  ExcelColumn, 
  ExcelData, 
  TooltipState,
  BatchInfo
} from '@/types/nsdl';

// Logic Modules
import { 
  getCurrentDate, 
  getCurrentTime, 
  autoDetectModeOfPayment,
  formatDateToBatch,
  normalizeDematPair,
  cleanDematField
} from '@/lib/nsdl-utils';
import { 
  parseNSDLBatch, 
  convertCSVToBatch 
} from '@/lib/nsdl-parser';
import { getBatchRecords, markBatchGenerate, getBatchConfig, updateBatchConfig } from '@/lib/batch-api';
import { 
  getRecordIssues 
} from '@/lib/nsdl-validator';
import { 
  generateBatchFile, 
  generateCSVContent 
} from '@/lib/nsdl-generator';

interface NSDLState {
  file: File | null;
  parsedData: ParsedData | null;
  error: string | null;
  loading: boolean;
  mode: string;
  hoveredRow: number | null;
  tooltip: TooltipState;
  editingCell: { rowIndex: number, field: keyof DetailRecord } | null;
  currentStep: number;
  excelData: ExcelData | null;
  showExcelMapping: boolean;
  excelColumns: ExcelColumn[];
  columnMapping: Record<string, ExcelColumn>;
  batchInfo: BatchInfo;
  dataSourceMode: 'file' | 'api';
  apiData: DetailRecord[];
  selectionRange: { start: number, end: number };
  selectedApiRows: Set<number>;
  apiDateRange: { start: string; end: string };
  
  // Computed (accessed via functions or getters in components)
  hasErrors: () => boolean;
}

interface NSDLActions {
  setFile: (file: File | null) => void;
  setParsedData: (data: ParsedData | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setMode: (mode: string) => void;
  setHoveredRow: (row: number | null) => void;
  setTooltip: (tooltip: TooltipState) => void;
  setEditingCell: (cell: { rowIndex: number, field: keyof DetailRecord } | null) => void;
  setCurrentStep: (step: number) => void;
  setBatchInfo: (info: BatchInfo) => void;
  setColumnMapping: (mapping: Record<string, ExcelColumn> | ((prev: Record<string, ExcelColumn>) => Record<string, ExcelColumn>)) => void;
  setShowExcelMapping: (show: boolean) => void;
  setDataSourceMode: (mode: 'file' | 'api') => void;
  setSelectionRange: (range: { start: number, end: number }) => void;
  setApiDateRange: (range: { start: string; end: string }) => void;
  toggleApiRow: (idx: number) => void;
  toggleAllApiRows: () => void;
  clearApiSelection: () => void;
  fetchApiData: () => Promise<void>;
  convertApiToParsedData: () => void;
  
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  convertExcelToCSV: () => void;
  handleCellEdit: (rowIndex: number, field: keyof DetailRecord, value: any) => void;
  handleDownloadExcel: () => void;
  handleDownloadBatch: () => void;
  resetWizard: () => void;
}

export const useNSDLStore = create<NSDLState & NSDLActions>((set, get) => ({
  // --- Initial State ---
  file: null,
  parsedData: null,
  error: null,
  loading: false,
  mode: 'excel-to-batch',
  hoveredRow: null,
  tooltip: { visible: false, x: 0, y: 0, content: '' },
  editingCell: null,
  currentStep: 1,
  excelData: null,
  showExcelMapping: false,
  excelColumns: [],
  columnMapping: {},
  batchInfo: {
    batchNumber: '',
    dpId: '',
    clientId: ''
  },
  dataSourceMode: 'file',
  apiData: [],
  selectionRange: { start: 1, end: 10 },
  selectedApiRows: new Set<number>(),
  apiDateRange: { start: '', end: '' },

  // --- Computed ---
  hasErrors: () => {
    const { parsedData } = get();
    return parsedData?.detailRecords.some((record, idx) => getRecordIssues(record, idx).length > 0) || false;
  },

  // --- Actions ---
  setFile: (file) => set({ file }),
  setParsedData: (parsedData) => set({ parsedData }),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
  setMode: (mode) => set({ mode }),
  setHoveredRow: (hoveredRow) => set({ hoveredRow }),
  setTooltip: (tooltip) => set({ tooltip }),
  setEditingCell: (editingCell) => set({ editingCell }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setBatchInfo: (batchInfo) => {
    set({ batchInfo });
  },
  setColumnMapping: (mapping) => {
    if (typeof mapping === 'function') {
      set((state) => ({ columnMapping: mapping(state.columnMapping) }));
    } else {
      set({ columnMapping: mapping });
    }
  },
  setShowExcelMapping: (showExcelMapping) => set({ showExcelMapping }),
  setDataSourceMode: async (dataSourceMode) => {
    set({ dataSourceMode });
    // When switching to API mode, restore saved batch info from Database
    if (dataSourceMode === 'api') {
      set({ loading: true });
      try {
        const config = await getBatchConfig();
        set({
          batchInfo: {
            batchNumber: config.batchNumber || '',
            dpId: config.dpId || '',
            clientId: config.clientId || ''
          }
        });
      } catch (err) {
        console.error("Failed to load batch config from database", err);
      } finally {
        set({ loading: false });
      }
    }
  },
  setSelectionRange: (selectionRange) => set({ selectionRange }),
  setApiDateRange: (apiDateRange) => set({ apiDateRange }),
  toggleApiRow: (idx) => {
    const { selectedApiRows } = get();
    const next = new Set(selectedApiRows);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    set({ selectedApiRows: next });
  },
  toggleAllApiRows: () => {
    const { apiData, selectedApiRows } = get();
    const selectableIndices = apiData.map((r, i) => (!r.isBatchGenerated ? i : -1)).filter(i => i >= 0);
    const allSelected = selectableIndices.every(i => selectedApiRows.has(i));
    set({ selectedApiRows: allSelected ? new Set<number>() : new Set(selectableIndices) });
  },
  clearApiSelection: () => set({ selectedApiRows: new Set<number>() }),

  fetchApiData: async () => {
    set({ loading: true, error: null });
    try {
      const { apiDateRange } = get();
      const [records, config] = await Promise.all([
        getBatchRecords(apiDateRange.start, apiDateRange.end),
        getBatchConfig()
      ]);
      const mappedRecords = records.map((r: any) => ({
        ...r,
        considerationAmount: Math.floor(parseFloat(String(r.considerationAmount)) || 0)
      }));
      set({ 
        apiData: mappedRecords, 
        batchInfo: {
          batchNumber: config.batchNumber || '',
          dpId: config.dpId || '',
          clientId: config.clientId || ''
        },
        loading: false 
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch batch records', loading: false });
    }
  },

  convertApiToParsedData: () => {
    const { apiData, selectedApiRows, batchInfo } = get();
    if (!batchInfo.batchNumber || !batchInfo.dpId || !batchInfo.clientId) {
      set({ error: 'Please provide all required batch info (Batch Seq, DP ID, and Client ID) in the table header above.' });
      return;
    }
    if (apiData.length === 0) {
      set({ error: 'No data to convert' });
      return;
    }

    if (selectedApiRows.size === 0) {
      set({ error: 'Please select the records you want to include in the batch.' });
      return;
    }

    // Get selected records, filter out already generated ones
    const selectedRecords = Array.from(selectedApiRows)
      .sort((a, b) => a - b)
      .map(i => apiData[i])
      .filter((r): r is DetailRecord => !!r && !r.isBatchGenerated);

    if (selectedRecords.length === 0) {
      set({ error: 'All selected records have already been generated in previous batches.' });
      return;
    }

    set({
      parsedData: {
        headerData: {
          batchNumber: batchInfo.batchNumber,
          recordType: '11',
          dpId: batchInfo.dpId,
          clientId: batchInfo.clientId,
          totalRecords: selectedRecords.length,
          fileCreationDate: getCurrentDate(),
          fileCreationTime: getCurrentTime()
        },
        detailRecords: selectedRecords.map((rec, i) => {
          const { dpId, clientId } = normalizeDematPair(rec.dpId, rec.clientId);
          return {
            ...rec,
            dpId,
            clientId,
            lineNumber: String(i + 1),
            batchNumber: batchInfo.batchNumber,
            recordType: '12',
            transactionType: dpId?.startsWith('12') ? '925' : '904',
            transactionFlag: 'A',
            considerationAmount: Math.floor(parseFloat(String(rec.considerationAmount)) || 0),
            reasonCode: '01',
            purpose: '',
            marketType: '01',
            modeOfPayment: '03', // All API records use Electronic Payment
            executionDate: getCurrentDate(),
            dateOfPayment: rec.dateOfPayment ? formatDateToBatch(rec.dateOfPayment) : getCurrentDate()
          };
        }),
        trailerData: null
      },
      currentStep: 3
    });
  },

  handleCellEdit: (rowIndex, field, value) => {
    const { parsedData } = get();
    if (!parsedData) return;

    const updatedRecords = [...parsedData.detailRecords];
    let processedValue = value;
    if (field === 'transfereeName' && typeof value === 'string') {
      processedValue = value.toUpperCase();
    } else if (field === 'considerationAmount') {
      const numeric = parseFloat(String(value));
      processedValue = isNaN(numeric) ? 0 : Math.floor(numeric);
    } else if (field === 'clientId') {
      const currentDpId = updatedRecords[rowIndex]?.dpId || '';
      const { dpId, clientId } = normalizeDematPair(currentDpId, value);
      processedValue = clientId;
      if (dpId && dpId !== currentDpId) {
        updatedRecords[rowIndex] = {
          ...updatedRecords[rowIndex],
          dpId
        } as DetailRecord;
      }
    } else if (field === 'dpId') {
      const currentClientId = updatedRecords[rowIndex]?.clientId || '';
      const { dpId, clientId } = normalizeDematPair(value, currentClientId);
      processedValue = dpId;
      if (clientId && clientId !== currentClientId) {
        updatedRecords[rowIndex] = {
          ...updatedRecords[rowIndex],
          clientId
        } as DetailRecord;
      }
    }
    
    updatedRecords[rowIndex] = {
      ...updatedRecords[rowIndex],
      [field]: processedValue
    } as DetailRecord;
    
    set({ parsedData: { ...parsedData, detailRecords: updatedRecords } });
  },

  handleFileUpload: async (event) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    const { mode } = get();
    set({ file: uploadedFile, error: null, loading: true });

    try {
      if (mode === 'excel-to-batch') {
        const fileName = uploadedFile.name.toLowerCase();
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
          set({ error: 'Please upload an .xlsx, .xls, or .csv file for Excel to Batch conversion', loading: false });
          return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const dataBuffer = e.target?.result;
            if (!dataBuffer || !(dataBuffer instanceof ArrayBuffer)) {
               throw new Error("Failed to read file");
            }
            const data = new Uint8Array(dataBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) throw new Error('Excel file has no sheets');
            const worksheet = workbook.Sheets[firstSheetName];
            if (!worksheet) throw new Error('Worksheet is empty or corrupted');
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];
            
            if (jsonData.length === 0 || !jsonData[0]) throw new Error('Excel file is empty');
            
            const headers: ExcelColumn[] = jsonData[0].map((header: any, index: number) => ({
              id: index,
              name: String(header || `Column ${index + 1}`)
            }));
            
            // Auto-mapping logic
            const autoMapping: Record<string, ExcelColumn> = {};
            const mappingPatterns: Record<string, string[]> = {
              'ISIN': ['isin'], 'Quantity': ['qty', 'quantity', 'qnty'],
              'Execution Date': ['date'], 'DP ID': ['client dp id'],
              'Client ID': ['client id'], 'Consideration Amount': ['total selling price', 'consideration amount'],
              'Mode of Payment': ['mode of payment'], 'Date of Receipt': ['date of receipt'],
              'Transferee Name': ['client name'], 'Bank Name': ['bank name'],
              'Bank Account Number': ['bank ac', 'account number'], 'Transaction ID': ['transaction reference', 'transaction id']
            };
            
            headers.forEach(column => {
              const columnNameLower = column.name.toLowerCase().trim();
              for (const [fieldName, patterns] of Object.entries(mappingPatterns)) {
                if (patterns.some(p => columnNameLower === p || columnNameLower.includes(p) || p.includes(columnNameLower))) {
                  if (!autoMapping[fieldName]) {
                    autoMapping[fieldName] = column;
                    break;
                  }
                }
              }
            });
            
            set({ 
              excelData: { workbook, worksheet, rawData: jsonData, headers, fileName: uploadedFile.name },
              excelColumns: headers,
              columnMapping: autoMapping,
              showExcelMapping: true,
              currentStep: 2,
              loading: false 
            });
          } catch (err: any) {
            set({ error: `Error processing XLSX file: ${err.message}`, loading: false });
          }
        };
        reader.readAsArrayBuffer(uploadedFile);
      } else if (mode === 'batch-to-csv') {
        if (!uploadedFile.name.endsWith('.txt')) {
          set({ error: 'Please upload a .txt file for Batch to CSV conversion', loading: false });
          return;
        }
        const content = await uploadedFile.text();
        set({ parsedData: parseNSDLBatch(content), currentStep: 3, loading: false });
      } else if (mode === 'csv-to-batch') {
        if (!uploadedFile.name.endsWith('.csv')) {
          set({ error: 'Please upload a .csv file for CSV to Batch conversion', loading: false });
          return;
        }
        const content = await uploadedFile.text();
        const converted = convertCSVToBatch(content);
        if (!converted.headerData && (!converted.detailRecords || converted.detailRecords.length === 0)) {
          throw new Error('No recognizable data found in CSV.');
        }
        set({ parsedData: converted, currentStep: 3, loading: false });
      }
    } catch (err: any) {
      set({ error: `Error processing file: ${err.message}`, loading: false });
    }
  },

  convertExcelToCSV: () => {
    const { excelData, batchInfo, columnMapping } = get();
    if (!excelData || !batchInfo.batchNumber || !batchInfo.dpId || !batchInfo.clientId) {
      set({ error: 'Please provide all required batch information (Batch Number, Sender DP ID, and Sender Client ID) in the form above.' });
      return;
    }

    try {
      const requiredFields = ['ISIN', 'Quantity'];
      const unmappedFields = requiredFields.filter(field => !columnMapping[field]);
      if (unmappedFields.length > 0) {
        set({ error: `Please map all required fields: ${unmappedFields.join(', ')}` });
        return;
      }

      const rawData = excelData.rawData;
      const dataRows = rawData.slice(1);
      const validRows = dataRows.filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));

      set({
        parsedData: {
          detailRecords: validRows.map((row, i): DetailRecord => {
            let transactionDate = getCurrentDate();
            if (columnMapping['Date of Receipt']) {
              const rawTransactionDate = String(row[columnMapping['Date of Receipt'].id] || '').trim();
              if (rawTransactionDate) {
                const dateParts = rawTransactionDate.split(/[\r\n]+/);
                const lastDate = dateParts[dateParts.length - 1]?.trim() || '';
                transactionDate = formatDateToBatch(lastDate) || getCurrentDate();
              }
            }
            
            const transactionId = columnMapping['Transaction ID'] ? String(row[columnMapping['Transaction ID'].id] || '').trim() : '';
            const bankAccountNumber = columnMapping['Bank Account Number'] ? String(row[columnMapping['Bank Account Number'].id] || '').trim() : '';

            const rawDpId = columnMapping['DP ID'] ? row[columnMapping['DP ID'].id] : '';
            const rawClientId = columnMapping['Client ID'] ? row[columnMapping['Client ID'].id] : '';
            const { dpId: dpIdVal, clientId: clientIdVal } = normalizeDematPair(rawDpId, rawClientId);
            const isCDSL = dpIdVal.startsWith('12') || dpIdVal === 'IN000026';
            const transactionType = isCDSL ? '925' : '904';

            return {
              batchNumber: batchInfo.batchNumber,
              recordType: '12',
              lineNumber: String(i + 1),
              transactionType: transactionType,
              transactionFlag: 'A',
              isin: columnMapping['ISIN'] ? String(row[columnMapping['ISIN'].id] || '').trim() : '',
              quantity: columnMapping['Quantity'] ? parseFloat(String(row[columnMapping['Quantity'].id] || '0')) || 0 : 0,
              executionDate: getCurrentDate(),
              dpId: dpIdVal,
              clientId: clientIdVal,
              considerationAmount: columnMapping['Consideration Amount'] ? Math.floor(parseFloat(String(row[columnMapping['Consideration Amount'].id] || '0'))) || 0 : 0,
              reasonCode: '01',
              purpose: '',
              marketType: '01',
              modeOfPayment: autoDetectModeOfPayment(transactionId, bankAccountNumber),
              dateOfPayment: transactionDate,
              transfereeName: columnMapping['Transferee Name'] ? String(row[columnMapping['Transferee Name'].id] || '').trim().toUpperCase() : '',
              bankName: columnMapping['Bank Name'] ? String(row[columnMapping['Bank Name'].id] || '').trim() : '',
              bankAccountNumber: bankAccountNumber,
              transactionId: transactionId
            };
          }),
          headerData: {
            batchNumber: batchInfo.batchNumber,
            recordType: '11',
            dpId: batchInfo.dpId,
            clientId: batchInfo.clientId,
            totalRecords: validRows.length,
            fileCreationDate: getCurrentDate(),
            fileCreationTime: getCurrentTime()
          },
          trailerData: null
        },
        showExcelMapping: false,
        currentStep: 3
      });
    } catch (err: any) {
      set({ error: `Error converting Excel: ${err.message}` });
    }
  },

  handleDownloadExcel: () => {
    const { parsedData, file } = get();
    if (!parsedData) return;
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#34d399', '#059669'] });
    const csvContent = generateCSVContent(parsedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${file?.name.replace('.txt', '') || 'parsed'}_parsed.csv`;
    link.click();
  },

  handleDownloadBatch: async () => {
    const { parsedData, dataSourceMode, fetchApiData } = get();
    if (!parsedData) return;
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#34d399', '#059669'] });
    const batchContent = generateBatchFile(parsedData);
    const batchNumber = parsedData.headerData ? parsedData.headerData.batchNumber : '1000080';
    const cleanBatchNumber = String(batchNumber).replace(/"/g, '').trim();
    const blob = new Blob([batchContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SMC${cleanBatchNumber}.txt`;
    link.click();

    // Auto-marking as generated has been removed. 
    // Records will be marked as generated when uploaded with a Batch Sequence via the Operations panel.

    if (dataSourceMode === 'api') {
      // Auto-increment batch number locally for next export in API mode
      const currentBatch = parseInt(cleanBatchNumber, 10);
      if (!isNaN(currentBatch)) {
        const nextBatch = String(currentBatch + 1);
        const { batchInfo } = get();
        const updatedBatchInfo = { ...batchInfo, batchNumber: nextBatch };
        set({ batchInfo: updatedBatchInfo });
      }
    }
  },

  resetWizard: () => {
    set({
      currentStep: 1,
      file: null,
      parsedData: null,
      error: null,
      showExcelMapping: false,
      excelData: null,
      columnMapping: {}
    });
  }
}));
