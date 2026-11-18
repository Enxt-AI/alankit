import * as XLSX from 'xlsx';

export interface HeaderData {
  batchNumber: string;
  recordType: string;
  dpId: string;
  clientId: string;
  totalRecords: string | number;
  fileCreationDate: string;
  fileCreationTime: string;
}

export interface DetailRecord {
  batchNumber?: string;
  recordType?: string;
  lineNumber?: string;
  transactionType?: string;
  transactionFlag?: string;
  isin: string;
  quantity: number;
  executionDate: string;
  dpId: string;
  clientId: string;
  considerationAmount: number;
  reasonCode?: string;
  purpose?: string;
  marketType?: string;
  modeOfPayment: string;
  dateOfPayment: string;
  transfereeName: string;
  bankAccountNumber: string;
  bankName: string;
  transactionId: string;
  batchSequence?: number;
  isBatchGenerated?: boolean;
}

export interface TrailerData {
  batchNumber: string;
  recordType: string;
  deliveryToPoolQty: string;
  deliveryToClientQty: string;
  interDepositoryQty: string;
  grandTotalQty: string;
}

export interface ParsedData {
  headerData: HeaderData | null;
  detailRecords: DetailRecord[];
  trailerData: TrailerData | null;
}

export interface ExcelColumn {
  id: number;
  name: string;
}

export interface ExcelData {
  workbook: XLSX.WorkBook;
  worksheet: XLSX.WorkSheet;
  rawData: any[][];
  headers: ExcelColumn[];
  fileName: string;
}

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

export interface BatchInfo {
  batchNumber: string;
  dpId: string;
  clientId: string;
}
