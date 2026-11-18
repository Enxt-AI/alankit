import { 
  HeaderData, 
  DetailRecord, 
  TrailerData, 
  ParsedData 
} from '@/types/nsdl';
import { 
  getCurrentDate, 
  getCurrentTime, 
  formatDateToBatch, 
  autoDetectModeOfPayment,
  normalizeDematPair 
} from './nsdl-utils';

/**
 * Handle different line endings (Windows CRLF, Unix LF, Mac CR)
 */
export const normalizeLineEndings = (content: string): string => {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

/**
 * Helper function to format date from YYYYMMDD to DD/MM/YYYY
 */
export const formatDateFromBatch = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return '';
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}/${month}/${year}`;
};

/**
 * Helper function to convert mode of payment code to description
 */
export const getModeOfPaymentFromCode = (code: string) => {
  const modes: Record<string, string> = {
    '01': 'Cash',
    '02': 'Cheque',
    '03': 'Electronic Payment'
  };
  return modes[code] || code;
};

/**
 * Core parsing logic for NSDL Batch files (.txt)
 */
export const parseNSDLBatch = (content: string): ParsedData => {
  try {
    const lines = content.split('\n').filter(line => line.trim());
    
    let headerData: HeaderData | null = null;
    let detailRecords: DetailRecord[] = [];
    let trailerData: TrailerData | null = null;

    for (let line of lines) {
      if (line.startsWith('{}')) continue;
      
      const recordType = line.substring(7, 9);
      
      if (recordType === '11') {
        headerData = {
          batchNumber: line.substring(0, 7).trim(),
          recordType: '11',
          dpId: line.substring(15, 23).trim(),
          clientId: line.substring(23, 31).trim(),
          totalRecords: line.substring(31, 36).trim(),
          fileCreationDate: line.substring(36, 44).trim(),
          fileCreationTime: line.substring(44, 48).trim()
        };
      } else if (recordType === '12') {
        const batchNumber = line.substring(0, 7).trim();
        const lineNumber = line.substring(9, 14).trim();
        const transactionType = line.substring(14, 17).trim();
        const transactionFlag = line.substring(17, 18).trim();
        const isin = line.substring(25, 37).trim();
        const quantityStr = line.substring(37, 52).trim();
        const executionDate = line.substring(61, 69).trim();
        
        let record: DetailRecord = {
          batchNumber,
          recordType: '12',
          lineNumber,
          transactionType,
          transactionFlag,
          isin,
          quantity: parseInt(quantityStr) / 1000,
          executionDate: formatDateFromBatch(executionDate),
          dpId: line.substring(69, 77).trim(),
          clientId: line.substring(77, 85).trim(),
          considerationAmount: parseInt(line.substring(113, 128).trim()) || 0,
          reasonCode: line.substring(128, 130).trim(),
          purpose: line.substring(131, 153).trim(),
          marketType: line.substring(153, 155).trim(),
          modeOfPayment: getModeOfPaymentFromCode(line.substring(173, 175).trim()),
          dateOfPayment: formatDateFromBatch(line.substring(175, 183).trim()),
          transfereeName: line.substring(183, 318).trim(),
          bankAccountNumber: line.substring(318, 348).trim(),
          bankName: line.substring(348, 383).trim(),
          transactionId: line.substring(383, 408).trim()
        };

        detailRecords.push(record);
      } else if (recordType === '19') {
        trailerData = {
          batchNumber: line.substring(0, 7).trim(),
          recordType: '19',
          deliveryToPoolQty: line.substring(15, 30).trim(),
          deliveryToClientQty: line.substring(30, 45).trim(),
          interDepositoryQty: line.substring(45, 60).trim(),
          grandTotalQty: line.substring(135, 150).trim()
        };
      }
    }

    return { headerData, detailRecords, trailerData };
  } catch (err: any) {
    throw new Error(`Parsing error: ${err.message}`);
  }
};

/**
 * Handle potential Excel CSV formatting issues
 * Remove BOM (Byte Order Mark) if present
 */
export const cleanCSVLine = (line: string): string => {
  if (line.charCodeAt(0) === 0xFEFF) {
    return line.slice(1);
  }
  return line;
};

/**
 * Preserve leading zeros and prevent scientific notation conversion for CSV fields
 */
export const preserveNumericFormat = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '';
  let strValue = String(value).trim();
  strValue = strValue.replace(/^="/, '').replace(/"$/, '').replace(/^=/, '').replace(/^"/, '').replace(/"$/, '');
  
  if (strValue.includes('E+') || strValue.includes('e+')) {
    const num = parseFloat(strValue);
    if (!isNaN(num) && strValue.length <= 15) {
      return num.toString();
    }
  }
  return strValue;
};

/**
 * Robust CSV field extraction that handles quoted fields with commas
 */
export const extractCSVFields = (line: string): string[] => {
  if (!line.includes(',')) return [line];
  
  let inQuote = false;
  let currentField = '';
  let fieldArray = [];
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (char === '"') {
      if (inQuote && j + 1 < line.length && line[j + 1] === '"') {
        currentField += '"';
        j++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      fieldArray.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  fieldArray.push(currentField.trim());
  return fieldArray;
};

/**
 * Convert CSV content to ParsedData
 */
export const convertCSVToBatch = (csvContent: string): ParsedData => {
  try {
    const normalizedContent = normalizeLineEndings(csvContent);
    const lines = normalizedContent.split('\n');
    
    let headerData: HeaderData | null = null;
    let detailRecords: DetailRecord[] = [];
    let trailerData: TrailerData | null = null;
    let currentSection = '';
    let batchNumberFromHeader = null;

    for (let i = 0; i < lines.length; i++) {
      let line = cleanCSVLine(lines[i]?.trim() || '');
      if (!line || /^[\s,]*$/.test(line)) continue;
      
      const upperLine = line.toUpperCase();
      if (upperLine.includes('HEADER INFORMATION')) {
        currentSection = 'header';
        continue;
      } else if (upperLine.includes('DETAIL RECORDS')) {
        currentSection = 'detail';
        continue;
      } else if (upperLine.includes('TRAILER INFORMATION')) {
        currentSection = 'trailer';
        continue;
      }

      if (line.startsWith('S.No,') || 
          line.startsWith('Batch Number,') || 
          line.startsWith('ISIN,Quantity') ||
          line.includes('Delivery to Pool Qty')) {
        continue;
      }

      const fields = extractCSVFields(line);

      if (currentSection === 'header' && fields.length >= 3) {
        const batchNumber = preserveNumericFormat(fields[0]) || '1000080';
        batchNumberFromHeader = batchNumber;
        
        const rawDp = preserveNumericFormat(fields[2]);
        const rawClient = preserveNumericFormat(fields[3]);
        const { dpId, clientId } = normalizeDematPair(rawDp, rawClient);

        headerData = {
          batchNumber: batchNumber,
          recordType: fields[1] || '11',
          dpId: dpId,
          clientId: clientId,
          totalRecords: fields[4] || String(detailRecords.length),
          fileCreationDate: fields[5] || getCurrentDate(),
          fileCreationTime: fields[6] || getCurrentTime()
        };
      } else if (currentSection === 'detail' && fields.length >= 10) {
        if (fields.some(field => field && field.trim() !== '')) {
          const rawDp = preserveNumericFormat(fields[4]);
          const rawClient = preserveNumericFormat(fields[5]);
          const { dpId, clientId } = normalizeDematPair(rawDp, rawClient);
          const isCDSL = dpId.startsWith('12') || dpId === 'IN000026';

          const record: DetailRecord = {
            batchNumber: batchNumberFromHeader || '1000080',
            recordType: '12',
            lineNumber: String(detailRecords.length + 1),
            transactionType: fields[1] || (isCDSL ? '925' : '904'),
            transactionFlag: 'A',
            isin: fields[1] || '',
            quantity: parseFloat(fields[2] || '') || 0,
            executionDate: fields[3] || getCurrentDate(),
            dpId: dpId,
            clientId: clientId,
            considerationAmount: Math.floor(parseFloat(fields[6] || '')) || 0,
            reasonCode: '01',
            purpose: '',
            marketType: '01',
            modeOfPayment: fields[7] || '03',
            dateOfPayment: fields[8] || getCurrentDate(),
            transfereeName: fields[9] || '',
            bankName: fields[10] || '',
            bankAccountNumber: preserveNumericFormat(fields[11]) || '',
            transactionId: preserveNumericFormat(fields[12]) || ''
          };
          detailRecords.push(record);
        }
      } else if (currentSection === 'trailer' && fields.length >= 3) {
        trailerData = {
          batchNumber: preserveNumericFormat(fields[0]) || batchNumberFromHeader || '1000080',
          recordType: fields[1] || '19',
          deliveryToPoolQty: fields[2] || '0',
          deliveryToClientQty: fields[3] || '0',
          interDepositoryQty: fields[4] || '0',
          grandTotalQty: fields[5] || '0'
        };
      }
    }

    if (!headerData) {
      headerData = {
        batchNumber: batchNumberFromHeader || '1000080',
        recordType: '11',
        dpId: '',
        clientId: '',
        totalRecords: String(detailRecords.length),
        fileCreationDate: getCurrentDate(),
        fileCreationTime: getCurrentTime()
      };
    }

    return { headerData, detailRecords, trailerData };
  } catch (err: any) {
    throw new Error(`CSV parsing error: ${err.message}`);
  }
};
