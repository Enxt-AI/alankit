import { DetailRecord } from '@/types/nsdl';

/**
 * Validation logic for NSDL Detail Records
 */
export const getRecordIssues = (record: DetailRecord, idx: number) => {
  const issues: { field: string; message: string }[] = [];
  
  // Required fields validation
  const requiredFields: Array<{ key: keyof DetailRecord; label: string }> = [
    { key: 'isin', label: 'ISIN' },
    { key: 'dpId', label: 'DP ID' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'considerationAmount', label: 'Consideration Amount' },
    { key: 'transfereeName', label: 'Transferee Name' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'bankAccountNumber', label: 'Account No' },
  ];

  requiredFields.forEach(({ key, label }) => {
    const val = record[key];
    const isMissing = val === undefined || val === null || String(val).trim() === '' || String(val).trim() === '—';
    if (isMissing) {
      issues.push({ field: key, message: `Required field is missing` });
    }
  });

  if (record.isin && record.isin.length !== 12) {
    issues.push({ field: 'isin', message: `Length must be 12 (Current: ${record.isin.length})` });
  }
  if (record.dpId && record.dpId.length !== 8) {
    issues.push({ field: 'dpId', message: `Length must be 8 (Current: ${record.dpId.length})` });
  }
  if (record.clientId) {
    const cleanClient = String(record.clientId).trim();
    if (cleanClient.length !== 8) {
      issues.push({ field: 'clientId', message: `Length must be 8 (Current: ${cleanClient.length})` });
    } else if (!/^\d{8}$/.test(cleanClient)) {
      issues.push({ field: 'clientId', message: `Must contain only digits (Current contains invalid characters)` });
    }
  }

  if (record.transfereeName && record.transfereeName.length > 135) {
    issues.push({ field: 'transfereeName', message: `Length > 135 (Current: ${record.transfereeName.length})` });
  }
  if (record.bankAccountNumber && record.bankAccountNumber.length > 30) {
    issues.push({ field: 'bankAccountNumber', message: `Length > 30 (Current: ${record.bankAccountNumber.length})` });
  }
  if (record.bankAccountNumber) {
    const accountNum = String(record.bankAccountNumber).trim();
    if (!/^\d*$/.test(accountNum)) {
      issues.push({ field: 'bankAccountNumber', message: 'Contains non-numeric characters' });
    }
  }
  if (record.bankName && record.bankName.length > 35) {
    issues.push({ field: 'bankName', message: `Length > 35 (Current: ${record.bankName.length})` });
  }
  if (record.transactionId && record.transactionId.length > 25) {
    issues.push({ field: 'transactionId', message: `Length > 25 (Current: ${record.transactionId.length})` });
  }
  
  // Quantity validation
  if (record.quantity) {
    const qtyStr = String(record.quantity).trim();
    if (!/^\d+$/.test(qtyStr)) {
      if (qtyStr.includes('.')) {
        issues.push({ field: 'quantity', message: 'Decimal values not allowed (must be whole number)' });
      } else {
        issues.push({ field: 'quantity', message: 'Must contain only numbers (no letters or special characters)' });
      }
    }
    if (qtyStr.replace(/\D/g, '').length > 15) {
      issues.push({ field: 'quantity', message: `Max 15 digits allowed (Current: ${qtyStr.replace(/\D/g, '').length})` });
    }
  }
  
  // Consideration Amount validation
  if (record.considerationAmount) {
    const amtStr = String(record.considerationAmount).trim();
    if (!/^\d+$/.test(amtStr)) {
      if (amtStr.includes('.')) {
        issues.push({ field: 'considerationAmount', message: 'Decimal values not allowed (must be whole number)' });
      } else {
        issues.push({ field: 'considerationAmount', message: 'Must contain only numbers (no letters or special characters)' });
      }
    }
    if (amtStr.replace(/\D/g, '').length > 15) {
      issues.push({ field: 'considerationAmount', message: `Max 15 digits allowed (Current: ${amtStr.replace(/\D/g, '').length})` });
    }
  }
  
  // SPEED-e: Transaction flag must be 'A' (default per NSDL spec)
  if (record.transactionFlag && record.transactionFlag !== 'A') {
    issues.push({ field: 'transactionFlag', message: `Must be 'A' per NSDL spec (Current: '${record.transactionFlag}')` });
  }

  // SPEED-e: Purpose must be blank for all reason codes except '89' (only allowed/mandatory for reason code 89)
  const reasonCode = record.reasonCode || '01';
  if (reasonCode !== '89' && record.purpose && record.purpose.trim() !== '') {
    issues.push({ field: 'purpose', message: 'Purpose field must be blank for this reason code (only valid for reason code 89)' });
  }

  // Date validations helper
  const validateDateRecord = (dateStr: string) => {
    if (!dateStr) return null;
    const cleanDate = String(dateStr).trim();
    if (cleanDate === '') return null;
    if (!/^\d{8}$/.test(cleanDate)) return `Invalid format (Expected YYYYMMDD)`;
    return null;
  };

  const execDateError = validateDateRecord(record.executionDate);
  if (execDateError) issues.push({ field: 'executionDate', message: execDateError });

  const payDateError = validateDateRecord(record.dateOfPayment);
  if (payDateError) issues.push({ field: 'dateOfPayment', message: payDateError });

  return issues;
};

/**
 * Header-level validation for NSDL batch info
 */
export const getHeaderIssues = (batchInfo: { batchNumber: string; dpId: string; clientId: string }) => {
  const issues: { field: string; message: string }[] = [];

  const numeric = String(batchInfo.batchNumber || '').replace(/\D/g, '');
  if (numeric.length === 0) {
    issues.push({ field: 'batchNumber', message: 'Batch number is required' });
  } else if (numeric.length > 7) {
    issues.push({ field: 'batchNumber', message: `Max 7 digits allowed (Current: ${numeric.length})` });
  }

  if (!batchInfo.dpId || batchInfo.dpId.length !== 8) {
    issues.push({ field: 'dpId', message: `DP ID must be exactly 8 characters (Current: ${batchInfo.dpId?.length || 0})` });
  }

  if (!batchInfo.clientId || batchInfo.clientId.length !== 8) {
    issues.push({ field: 'clientId', message: `Client ID must be exactly 8 characters (Current: ${batchInfo.clientId?.length || 0})` });
  }

  return issues;
};

