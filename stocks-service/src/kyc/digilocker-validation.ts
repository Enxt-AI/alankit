import { BadRequestException } from '@nestjs/common';

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR = /^(?:[2-9]\d{11}|[xX*]{8}\d{4})$/;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

/** Accept only identity data returned by this provider attempt, never old KYC data. */
export function validateDigilockerIdentity(model: any, xmlPan = '') {
  const pan = text(xmlPan || model.pan?.panNumber || model.panNumber).toUpperCase();
  const aadhaar = text(model.maskedAdharNumber || model.aadhaar?.aadhaarNumber || model.aadhaarNumber)
    .replace(/\s/g, '');
  const name = text(model.aadhaar?.name || model.name);
  const dob = text(model.aadhaar?.dob || model.dob);
  if (!PAN.test(pan) || !AADHAAR.test(aadhaar) || !name || !dob ||
      model.pan?.verified === false || model.aadhaar?.verified === false) {
    throw new BadRequestException('DigiLocker did not return complete verified PAN and Aadhaar details. Please complete verification again.');
  }
  return { pan, aadhaar, name, dob };
}

export function hasCurrentDigilockerVerification(data: any): boolean {
  return Boolean(data.digitapTransactionId &&
    data.verifiedTransactionId === data.digitapTransactionId &&
    data.panDetails?.verified === true && data.aadhaarDetails?.verified === true &&
    PAN.test(data.panDetails.pan || '') && AADHAAR.test(data.aadhaarDetails.aadhaar || ''));
}
