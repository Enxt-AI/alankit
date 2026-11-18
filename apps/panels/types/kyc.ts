export interface VerifyPanRequest {
  pan: string;
  fullName: string;
  dob: string;
}

export interface SendAadhaarOtpRequest {
  aadhaar: string;
}

export interface VerifyAadhaarOtpRequest {
  aadhaar: string;
  otp: string;
}

export interface SubmitBankDetailsRequest {
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
}

export interface KycStatusResponse {
  kycStatus: string;
  currentStep: number;
  currentKycStep: number;
  submittedAt: string | null;
  panVerified: boolean;
  aadhaarVerified: boolean;
  bankVerified: boolean;
  documentsUploaded: {
    panCard: boolean;
    aadhaarFront: boolean;
    aadhaarBack: boolean;
  };
  canSubmit: boolean;
  firstVerifiedAt?: string | null;
  hasBeenVerified?: boolean;
  kycUpdatesCount?: number;
  kycUpdatesRemaining?: number;
  maxKycUpdatesPerYear?: number;
  canUpdateKyc?: boolean;
  nextKycUpdateAvailableAt?: string | null;
}

export interface KycApiResponse {
  success: boolean;
  message: string;
  data?: any;
}
