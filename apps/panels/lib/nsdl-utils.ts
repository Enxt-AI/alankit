/**
 * Utility functions for NSDL Batch Processing
 */

/**
 * Get current date in YYYYMMDD format
 */
export const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Get current time in HHMM format
 */
export const getCurrentTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
};

/**
 * Format batch number to exactly 7 digits with leading zeros.
 * Strips non-numeric characters and pads/truncates to 7.
 */
export const formatBatchNumber = (batchNumber: string): string => {
  const numeric = String(batchNumber).replace(/\D/g, '');
  if (numeric.length === 0) return '0000001';
  return numeric.padStart(7, '0').substring(0, 7);
};

/**
 * Helper function to format date from DD/MM/YYYY or MM/DD/YYYY to YYYYMMDD
 * Also handles Excel serial date numbers
 */
export const formatDateToBatch = (dateStr: any) => {
  if (!dateStr || dateStr.toString().trim() === '') return '        '; // 8 spaces for empty date
  
  // Remove any quotes
  dateStr = dateStr.toString().replace(/"/g, '').trim();
  
  // If already in YYYYMMDD format, return as is
  if (/^\d{8}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Handle Excel serial date numbers
  if (!isNaN(dateStr) && parseFloat(dateStr) > 0) {
    const serialDate = parseFloat(dateStr);
    const excelEpoch = new Date(1900, 0, 1);
    const adjustedDate = serialDate > 60 ? serialDate - 2 : serialDate - 1;
    const jsDate = new Date(excelEpoch.getTime() + (adjustedDate * 24 * 60 * 60 * 1000));
    
    const year = jsDate.getFullYear();
    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
    const day = String(jsDate.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  // Handle ISO Date Strings (e.g. 2024-03-31T12:00:00Z)
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  
  // Handle Excel date format
  if (dateStr.includes(' ')) {
    dateStr = dateStr.split(' ')[0];
  }
  
  let separator = '/';
  if (dateStr.includes('-')) {
    separator = '-';
  } else if (dateStr.includes('.')) {
    separator = '.';
  }
  
  let parts = [];
  if (dateStr.includes(separator)) {
    parts = dateStr.split(separator);
    if (parts.length === 3) {
      let day, month, year;
      
      if (parts[0].length === 4) {
        year = parts[0];
        month = String(parts[1]).padStart(2, '0');
        day = String(parts[2]).padStart(2, '0');
      } else {
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        
        if (first > 12 && second <= 12) {
          day = String(parts[0]).padStart(2, '0');
          month = String(parts[1]).padStart(2, '0');
          year = parts[2];
        } else if (second > 12 && first <= 12) {
          month = String(parts[0]).padStart(2, '0');
          day = String(parts[1]).padStart(2, '0');
          year = parts[2];
        } else {
          day = String(parts[0]).padStart(2, '0');
          month = String(parts[1]).padStart(2, '0');
          year = parts[2];
        }
      }
      
      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum < 30 ? `20${year.padStart(2, '0')}` : `19${year.padStart(2, '0')}`;
      }
      
      return `${year}${month}${day}`;
    }
  }
  
  return '        ';
};

/**
 * Pad numbers with leading zeros (left-aligned)
 */
export const padNumberLeft = (num: number | string, length: number) => {
  return num.toString().padStart(length, '0');
};

/**
 * Pad numbers with trailing spaces (right-aligned)
 */
export const padNumberRight = (num: number | string, length: number) => {
  return num.toString().padEnd(length, ' ');
};

/**
 * Pad strings with spaces (left-aligned)
 */
export const padString = (str: string, length: number) => {
  return str.padEnd(length, ' ');
};

/**
 * Pad strings with spaces (right-aligned)
 */
export const padStringRight = (str: string, length: number) => {
  return str.padStart(length, ' ');
};

/**
 * Convert mode of payment description back to code
 */
export const getModeOfPaymentCode = (description: string) => {
  const modes: Record<string, string> = {
    'Cash': '01',
    'Cheque': '02',
    'Electronic Payment': '03'
  };
  return modes[description] || '03';
};

/**
 * Get mode of payment display info (for UI badges)
 */
export const getModeOfPaymentDisplay = (code: string) => {
  const modes: Record<string, { label: string, icon: string, color: string }> = {
    '01': { label: 'Cash', icon: '💵', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    '02': { label: 'Cheque', icon: '📝', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    '03': { label: 'Bank', icon: '🏦', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  };
  return modes[code] || { label: code, icon: '❓', color: 'bg-slate-100 text-slate-700 border-slate-200' };
};

/**
 * Auto-detect mode of payment based on transaction/cheque ID
 * 01 = Cash (no transaction ID)
 * 02 = Cheque (ID length <= 5, since cheque numbers are typically 5 digits or less)
 * 03 = Bank Transfer (ID length > 5, bank transaction IDs are longer)
 */
export const autoDetectModeOfPayment = (transactionId: string | null | undefined, bankAccountNumber: string | null | undefined) => {
  const txnId = String(transactionId || '').trim();

  // If no transaction ID exists
  if (!txnId || txnId === '') {
    return '01'; // Cash
  }

  // If transaction ID is 5 characters or less, it's likely a cheque number
  if (txnId.length <= 5) {
    return '02'; // Cheque
  }

  // If transaction ID is longer than 5 characters, it's a bank transfer
  return '03'; // Electronic Payment / Bank Transfer
};

/**
 * Clean a Demat field (DP ID or Client ID) by removing Excel formulas, quotes,
 * scientific notation, trailing decimals, dashes, hyphens, and whitespace.
 */
export const cleanDematField = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Strip Excel quotes, formulas, apostrophes
  str = str.replace(/^="|^=|^"|"$|^'/g, '').trim();
  str = str.replace(/^"|"$/g, '').trim();
  // Handle scientific notation e.g. 1.23E+07
  if (str.includes('E+') || str.includes('e+')) {
    const num = parseFloat(str);
    if (!isNaN(num)) {
      str = num.toString().includes('e') ? num.toFixed(0) : num.toString();
    }
  }
  // Strip decimal point if Excel read it as float e.g. 123456.0
  str = str.replace(/\.0+$/, '');
  // Strip any leading minus/dash/hyphen or whitespace e.g. "-00123456" -> "00123456", "-0" -> "0"
  str = str.replace(/^[-\s]+/, '');
  // Remove all internal hyphens, spaces, slashes
  str = str.replace(/[-\s/]/g, '');
  return str;
};

/**
 * Normalizes DP ID and Client ID pair:
 * - Slices 16-character full Demat/BO ID if provided in DP ID or Client ID field
 * - Strips leading/internal hyphens, spaces, and quotes
 * - Pads numeric Client IDs with leading zeros up to 8 digits (e.g. 00123456, 01334567)
 * - Retains uppercase 8-char DP ID (e.g. IN300126 or 12081600)
 */
export const normalizeDematPair = (rawDpId: any, rawClientId: any): { dpId: string; clientId: string } => {
  let dpId = cleanDematField(rawDpId).toUpperCase();
  let clientId = cleanDematField(rawClientId);

  // If dpId has 16 characters and clientId is empty or dummy placeholder:
  if (dpId.length === 16 && (!clientId || clientId === '0' || clientId === '00' || clientId === '000')) {
    clientId = dpId.substring(8, 16);
    dpId = dpId.substring(0, 8);
  }
  // If clientId has 16 characters and dpId is empty or dummy placeholder:
  else if (clientId.length === 16 && (!dpId || dpId === '0' || dpId === '00')) {
    dpId = clientId.substring(0, 8).toUpperCase();
    clientId = clientId.substring(8, 16);
  }
  // If both have 16 characters and are identical:
  else if (dpId.length === 16 && clientId.length === 16 && dpId === clientId) {
    clientId = dpId.substring(8, 16);
    dpId = dpId.substring(0, 8);
  }
  // If dpId is 16 chars and clientId is 8 chars:
  else if (dpId.length === 16 && clientId.length === 8) {
    dpId = dpId.substring(0, 8);
  }
  // If clientId is 16 chars and dpId is 8 chars:
  else if (clientId.length === 16 && dpId.length === 8) {
    clientId = clientId.substring(8, 16);
  }
  // If combined length is 16 and dpId is not 8:
  else if (dpId.length + clientId.length === 16 && dpId.length !== 8) {
    const combined = `${dpId}${clientId}`;
    dpId = combined.substring(0, 8).toUpperCase();
    clientId = combined.substring(8, 16);
  }

  // Client ID: pad numeric client ID with leading zeros if shorter than 8 digits
  const numericClientId = clientId.replace(/\D/g, '');
  if (numericClientId.length > 0 && numericClientId.length <= 8) {
    if (/^\d+$/.test(clientId)) {
      clientId = clientId.padStart(8, '0');
    } else if (numericClientId.length > 0) {
      clientId = numericClientId.padStart(8, '0');
    }
  }

  return { dpId, clientId };
};

