import { 
  HeaderData, 
  DetailRecord, 
  ParsedData 
} from '@/types/nsdl';
import { 
  getCurrentDate, 
  getCurrentTime, 
  formatDateToBatch, 
  formatBatchNumber,
  padNumberLeft, 
  padNumberRight, 
  padString,
  autoDetectModeOfPayment,
  normalizeDematPair
} from './nsdl-utils';

/**
 * Trailer Record (150 chars total)
 */
export const generateTrailerRecord = (data: ParsedData): string => {
  const detailRecords = Array.isArray(data.detailRecords) ? data.detailRecords : [];
  
  const deliveryToClientQty = detailRecords
    .filter((record: DetailRecord) => record.dpId && record.dpId.startsWith('IN'))
    .reduce((sum: number, record: DetailRecord) => sum + (parseFloat(String(record.quantity)) || 0), 0);

  const interDepositoryQty = detailRecords
    .filter((record: DetailRecord) => record.dpId && record.dpId.startsWith('12'))
    .reduce((sum: number, record: DetailRecord) => sum + (parseFloat(String(record.quantity)) || 0), 0);

  const totalQuantity = detailRecords.reduce((sum: number, record: DetailRecord) => {
    return sum + (parseFloat(String(record.quantity)) || 0);
  }, 0);

  const deliveryToClientTotal = padNumberLeft(Math.round(deliveryToClientQty * 1000), 15);
  const interDepositoryTotal = padNumberLeft(Math.round(interDepositoryQty * 1000), 15);
  const grandTotal = padNumberLeft(Math.round(totalQuantity * 1000), 15);

  const batchNumber = data.headerData ? data.headerData.batchNumber : '1000080';

  return (
    formatBatchNumber(batchNumber) +
    '19' +
    '      ' +
    '000000000000000' +
    deliveryToClientTotal +
    interDepositoryTotal +
    '000000000000000' +
    '000000000000000' +
    '000000000000000' +
    '000000000000000' +
    '000000000000000' +
    grandTotal
  );
};

/**
 * Generate NSDL batch file content
 */
export const generateBatchFile = (data: ParsedData): string => {
  let batchContent = '{}' + '\r\n';

  // Header Record (50 chars total)
  if (data.headerData) {
    const h: HeaderData = data.headerData;
    const cleanBatchNumber = String(h.batchNumber || '').replace(/"/g, '');
    const cleanDpId = String(h.dpId || '').replace(/"/g, '');
    const cleanClientId = String(h.clientId || '').replace(/"/g, '');
    const totalRecordsCount = data.detailRecords ? data.detailRecords.length : 0;
    const cleanTotalRecords = padNumberLeft(totalRecordsCount, 5);
    
    const headerLine = 
      formatBatchNumber(cleanBatchNumber) +
      '11' +
      '      ' +
      padString(cleanDpId, 8) +
      padString(cleanClientId, 8) +
      cleanTotalRecords +
      getCurrentDate() +
      getCurrentTime() +
      '  ';
  
    batchContent += headerLine + '\r\n';
  }

  // Detail Records (600 chars total)
  if (data.detailRecords && data.detailRecords.length > 0) {
    data.detailRecords.forEach((record, idx) => {
      const execDate = formatDateToBatch(record.executionDate) || '        ';
      
      let payDate = '        ';
      if (record.dateOfPayment) {
        const rawPayDate = String(record.dateOfPayment).trim();
        if (rawPayDate) {
          const dateParts = rawPayDate.split(/[\r\n]+/);
          const lastDate = dateParts[dateParts.length - 1]?.trim() || '';
          payDate = formatDateToBatch(lastDate) || '        ';
        }
      }
      
      const getCleanValue = (value: string | number | null | undefined) => {
        if (!value) return '';
        let cleaned = String(value).replace(/=/g, '').replace(/"/g, '').trim();
        if (cleaned.includes('E+') || cleaned.includes('e+')) {
          const num = parseFloat(cleaned);
          if (!isNaN(num)) {
            cleaned = num.toString().includes('e') ? num.toFixed(0) : num.toString();
          }
        }
        return cleaned;
      };

      const cleanField = (value: string | number | null | undefined, maxLength: number) => {
        return getCleanValue(value).substring(0, maxLength);
      };
      
      const { dpId: cleanDpId, clientId: cleanClientId } = normalizeDematPair(record.dpId, record.clientId);

      const cleanIsin = cleanField(record.isin, 12);
      const cleanTransfereeName = cleanField(record.transfereeName, 135);
      const cleanBankName = cleanField(record.bankName, 35);
      const cleanBankAccount = cleanField(record.bankAccountNumber, 30);
      
      let cleanTransactionId = '';
      if (record.transactionId) {
        const rawTransactionId = String(record.transactionId).trim();
        if (rawTransactionId) {
          const idParts = rawTransactionId.split(/[\r\n]+/);
          const lastId = idParts[idParts.length - 1]?.trim() || '';
          cleanTransactionId = cleanField(lastId, 100);
        }
      }
      
      const quantityValue = padNumberLeft(String(Math.round((parseFloat(String(record.quantity)) || 0) * 1000)), 15);
      const considerationValue = Math.floor(parseFloat(String(record.considerationAmount)) || 0);
      const consideration = padNumberRight(String(considerationValue), 15);
      const modeCode = record.modeOfPayment || autoDetectModeOfPayment(cleanTransactionId, cleanBankAccount);

      let detailLine = '';
      const batchNumber = data.headerData ? (data.headerData.batchNumber || '') : '1000080';
      const cleanBatchNumber = String(batchNumber).replace(/"/g, '');
      
      detailLine += formatBatchNumber(cleanBatchNumber);
      detailLine += '12';
      detailLine += padNumberLeft(idx + 1, 5);
      const isInterDepository = cleanDpId.startsWith('12') || cleanDpId === 'IN000026';
      const txnType = isInterDepository ? '925' : (record.transactionType && record.transactionType !== '904' ? record.transactionType : '904');

      detailLine += padString(txnType, 3);
      detailLine += (record.transactionFlag || 'A');
      detailLine += '       ';
      detailLine += padString(cleanIsin, 12);
      detailLine += quantityValue;
      detailLine += '         ';
      detailLine += execDate;

      // If they manually put IN000026 in DP ID but gave an 8 digit client ID, we pass it as is. 
      // NSDL might reject it if it's not a valid 16-digit CDSL BO ID, but at least the layout is correct.
      detailLine += padString(cleanDpId, 8);
      detailLine += padString(cleanClientId, 8);
      
      if (isInterDepository) {
        detailLine += 'IN000026';
      } else {
        detailLine += '        ';
      }
      
      detailLine += padString(cleanBatchNumber, 20);
      detailLine += consideration;
      detailLine += '01';
      detailLine += ' ';
      // Purpose must be blank for all reason codes except '89' (per NSDL SPEED-e spec: "Mandatory for Reason code '89' and for remaining it will be spaces.")
      const reasonCode = record.reasonCode || '01';
      const purpose = (reasonCode === '89' && txnType !== '925') ? (record.purpose || '') : '';
      detailLine += padString(purpose, 22);
      detailLine += '  ';
      detailLine += '                  ';
      detailLine += modeCode;
      detailLine += payDate;
      detailLine += padString(cleanTransfereeName, 135);  // pos 184-318
      detailLine += padString(cleanBankAccount, 30);       // pos 319-348
      detailLine += padString(cleanBankName, 35);           // pos 349-383
      detailLine += padString(cleanTransactionId, 25);      // pos 384-408
      detailLine += ' ';                                    // pos 409 Filler
      // Stamp Duty Payment Indicator (pos 410) - Mandatory for reason code 01/27
      const stampDutyIndicator = (reasonCode === '01' || reasonCode === '27') ? '1' : ' ';
      detailLine += stampDutyIndicator;
      detailLine += 'N';                                    // pos 411 Without Consideration Flag
      // pos 412-600: Filler(10) + Block Indicator(1) + Client UCC(11) + Trading Member ID(16) + Exchange ID(2) + Segment ID(2) + Filler(147) = 189 chars
      detailLine += ''.padEnd(189, ' ');

      batchContent += detailLine + '\r\n';
    });
  }

  batchContent += generateTrailerRecord(data) + '\r\n';
  batchContent += '{}'+ '\r\n';
  return batchContent;
};

/**
 * Generate CSV content for NSDL data
 */
export const generateCSVContent = (data: ParsedData): string => {
  let csvContent = '';
  
  // Format numeric fields to prevent Excel from converting them to scientific notation
  const formatForExcel = (value: string | number) => {
    if (!value) return '""';
    const strValue = String(value);
    if (strValue.length >= 10 || /^\d+$/.test(strValue)) {
      return `"=""${strValue}"""`;
    }
    return `"${strValue}"`;
  };

  // Header Information
  csvContent += 'HEADER INFORMATION\n';
  csvContent += 'Batch Number,Record Type,DP ID,Client ID,Total Records,File Creation Date,File Creation Time\n';
  const h = data.headerData;
  if (h) {
    csvContent += `${formatForExcel(h.batchNumber)},${formatForExcel(h.recordType)},${formatForExcel(h.dpId)},${formatForExcel(h.clientId)},"${h.totalRecords}","${h.fileCreationDate}","${h.fileCreationTime}"\n\n`;
  }

  // Detail Records
  csvContent += 'DETAIL RECORDS\n';
  csvContent += 'S.No,ISIN,Quantity,Execution Date,DP ID,Client ID,Consideration Amount,Mode of Payment,Transaction Date,Transferee Name,Bank Name,Bank Account Number,Transaction/Cheque ID\n';

  data.detailRecords.forEach((r, idx) => {
    const cleanIsin = r.isin ? r.isin.replace(/=/g, '') : '';
    const cleanDpId = r.dpId ? r.dpId.replace(/=/g, '') : '';
    const cleanClientId = r.clientId ? r.clientId.replace(/=/g, '') : '';
    const cleanAmount = r.considerationAmount ? r.considerationAmount.toString().replace(/=/g, '') : '';
    const cleanMode = r.modeOfPayment ? r.modeOfPayment.replace(/=/g, '') : '';
    const cleanName = r.transfereeName ? r.transfereeName.replace(/=/g, '') : '';
    const cleanBank = r.bankName ? r.bankName.replace(/=/g, '') : '';
    const cleanAccount = r.bankAccountNumber ? r.bankAccountNumber.replace(/=/g, '') : '';
    const cleanTxnId = r.transactionId ? r.transactionId.replace(/=/g, '') : '';
    const cleanExecDate = r.executionDate ? r.executionDate.replace(/=/g, '') : '';
    const cleanPayDate = r.dateOfPayment ? r.dateOfPayment.replace(/=/g, '') : '';
  
    csvContent += `${idx + 1},`;
    csvContent += `"${cleanIsin}",`;
    csvContent += `${r.quantity},`;
    csvContent += `"${cleanExecDate}",`;
    csvContent += `${formatForExcel(cleanDpId)},`;
    csvContent += `${formatForExcel(cleanClientId)},`;
    csvContent += `${cleanAmount},`;
    csvContent += `"${cleanMode}",`;
    csvContent += `"${cleanPayDate}",`;
    csvContent += `"${cleanName}",`;
    csvContent += `"${cleanBank}",`;
    csvContent += `${formatForExcel(cleanAccount)},`;
    csvContent += `${formatForExcel(cleanTxnId)}\n`;
  });

  // Trailer Information
  csvContent += '\nTRAILER INFORMATION\n';
  csvContent += 'Batch Number,Record Type,Delivery to Pool Qty,Delivery to Client Qty,Inter Depository Qty,Grand Total Qty\n';
  
  if (data.trailerData) {
    const t = data.trailerData;
    const poolQty = t.deliveryToPoolQty ? (parseInt(t.deliveryToPoolQty) / 1000).toString() : '0';
    const clientQty = t.deliveryToClientQty ? (parseInt(t.deliveryToClientQty) / 1000).toString() : '0';
    const interQty = t.interDepositoryQty ? (parseInt(t.interDepositoryQty) / 1000).toString() : '0';
    const totalQty = t.grandTotalQty ? (parseInt(t.grandTotalQty) / 1000).toString() : '0';
    
    csvContent += `${formatForExcel(t.batchNumber)},${formatForExcel(t.recordType)},"${poolQty}","${clientQty}","${interQty}","${totalQty}"\n`;
  } else {
    const batchNumber = data.headerData ? data.headerData.batchNumber : '1000080';
    csvContent += `${formatForExcel(batchNumber)},${formatForExcel('19')},"0","0","0","0"\n`;
  }

  return csvContent;
};
