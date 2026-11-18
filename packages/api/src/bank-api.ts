import { stocksApi } from './api-client';

export interface LinkBankRequest {
  ifsc: string;
  accNo: string;
  benificiaryName?: string;
}

export interface BankVerification {
  accountNumber: string;
  accountType: string;
  bankName: string;
  branchName: string;
  nameProvided: string;
  nameAtBank: string;
  nameMatchStatus: 'MATCHED' | 'NOT_MATCHED';
  nameMatchScore: number;
  accountStatus: string;
  ifscValid: boolean;
  amlStatus: string;
  referenceId: string;
  verifiedAt: string;
}

export interface LinkBankResponse {
  success: boolean;
  message: string;
  data: {
    bankStatus: string;
    verification?: BankVerification;
  };
}

export interface BankStatusResponse {
  success: boolean;
  data: {
    bankStatus: string;
    bankData: any;
  };
}

/**
 * Custom error class that carries verification details from the backend
 * even when the request fails (e.g. name mismatch).
 */
export class BankVerificationError extends Error {
  verification?: BankVerification;

  constructor(message: string, verification?: BankVerification) {
    super(message);
    this.name = 'BankVerificationError';
    this.verification = verification;
  }
}

export async function linkBank(dto: LinkBankRequest): Promise<LinkBankResponse> {
  try {
    const response = await stocksApi.post('/bank/link', dto);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const resData = error.response.data;
      const message = resData?.message || 'Failed to link Bank account';
      const verification = resData?.verification as BankVerification | undefined;
      throw new BankVerificationError(message, verification);
    }
    throw new BankVerificationError(error.message || 'An unexpected error occurred');
  }
}

export async function getBankStatus(): Promise<BankStatusResponse> {
  try {
    const response = await stocksApi.get('/bank/status');
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.message || 'Failed to fetch Bank status');
    }
    throw new Error(error.message || 'An unexpected error occurred');
  }
}

/**
 * Reset Bank verification to redo it
 */
export async function resetBank(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.post('/bank/reset');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    }
    throw new Error(error.response?.data?.message || 'Failed to reset Bank verification. Please try again');
  }
}

