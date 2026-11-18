export enum KYCStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum DematStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
}

export enum BankStatus {
  NOT_LINKED = 'NOT_LINKED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface DematData {
  type: 'link' | 'create';
  accountNumber?: string;
  dpId?: string;
  clientId?: string;
  panNumber?: string;
  name?: string;
  mobile?: string;
  email?: string;
  address?: string;
  lastUpdatedAt?: string;
  submittedAt?: string;
}

export interface DematDocument {
  data: string;
  uploadedAt: string;
  fileName: string;
  fileSize: number;
}

export interface DematDocuments {
  dematStatement?: DematDocument;
  addressProof?: DematDocument;
}

export interface BankData {
  ifsc: string;
  accNo: string;
  benificiaryName: string;
  lastUpdatedAt?: string;
  submittedAt?: string;
  rejectionReason?: string;
}

export interface User {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  googleId: string | null;
  kycStatus: KYCStatus;
  // NOTE: referralCode and referredBy fields removed as part of referral system deprecation.
  currentStep: number;
  kycData: any | null;
  kycDocuments: any | null;
  dematStatus: DematStatus;
  dematData: DematData | null;
  dematDocuments: DematDocuments | null;
  bankStatus: BankStatus;
  bankData: BankData | null;
  needsGoogle?: boolean; // Add this field
  createdAt: string;
  updatedAt: string;
}

