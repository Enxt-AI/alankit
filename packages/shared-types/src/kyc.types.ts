/**
 * KYC Data Type Definitions
 * These types define the structure of JSON fields stored in User.kycData and User.kycDocuments
 */

export interface KycData {
  // Simplified mock KYC journey:
  // 1 = PAN, 2 = Upload Documents, 3 = Review & Submit
  // 0 is allowed for legacy/empty users who have not started.
  currentKycStep: 0 | 1 | 2 | 3;
  panDetails?: {
    pan: string;
    name: string;
    dob: string;
    verified: boolean;
  };
  // Legacy fields retained because older users/clients may still have them.
  // They are not required in the simplified flow.
  aadhaarDetails?: {
    aadhaar: string;
    verified: boolean;
    otpSent: boolean;
  };
  bankDetails?: {
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
    verified: boolean;
  };
  documentsUploaded?: {
    panCard?: boolean;
    aadhaarFront?: boolean;
    aadhaarBack?: boolean;
  };
  lastUpdatedStep?: string; // ISO timestamp
  submittedAt?: string; // ISO timestamp
}

export interface KycDocuments {
  panCard?: DocumentMetadata;
  aadhaarFront?: DocumentMetadata;
  aadhaarBack?: DocumentMetadata;
}

export interface DocumentMetadata {
  url: string;
  uploadedAt: string; // ISO timestamp
  fileSize: number; // bytes
  mimeType: string; // e.g., 'image/jpeg', 'application/pdf'
}

/**
 * KYC Step Enum
 * Maps to kycData.currentKycStep values
 */
export enum KycStep {
  PAN = 1,
  DOCUMENTS = 2,
  REVIEW = 3,
}

/**
 * User Journey Step Enum
 * Maps to User.currentStep values
 */
export enum UserJourneyStep {
  NEW = 0,
  EMAIL_GOOGLE = 1,
  PHONE_VERIFIED = 2,
  KYC_IN_PROGRESS = 3,
  KYC_COMPLETED = 4,
}
