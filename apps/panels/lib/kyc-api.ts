import { stocksApi } from './api-client';
import {
  VerifyPanRequest,
  SendAadhaarOtpRequest,
  VerifyAadhaarOtpRequest,
  SubmitBankDetailsRequest,
  KycStatusResponse,
  KycApiResponse,
} from '@/types/kyc';

/**
 * Verify PAN details
 */
export async function verifyPAN(dto: VerifyPanRequest): Promise<KycApiResponse> {
  try {
    const response = await stocksApi.post('/kyc/verify-pan', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid PAN details');
    } else if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to server. Please check your connection');
    }
    throw new Error('Failed to verify PAN. Please try again');
  }
}

/**
 * Send OTP to Aadhaar-linked mobile
 */
export async function sendAadhaarOTP(dto: SendAadhaarOtpRequest): Promise<KycApiResponse> {
  try {
    const response = await stocksApi.post('/kyc/aadhaar/send-otp', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid Aadhaar number');
    } else if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to server. Please check your connection');
    }
    throw new Error('Failed to send OTP. Please try again');
  }
}

/**
 * Verify Aadhaar OTP
 */
export async function verifyAadhaarOTP(dto: VerifyAadhaarOtpRequest): Promise<KycApiResponse> {
  try {
    const response = await stocksApi.post('/kyc/aadhaar/verify-otp', {
      aadhaar: dto.aadhaar,
      otp: dto.otp,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid OTP');
    } else if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to server. Please check your connection');
    }
    throw new Error('Failed to verify OTP. Please try again');
  }
}

/**
 * Submit bank details for verification
 */
export async function submitBankDetails(dto: SubmitBankDetailsRequest): Promise<KycApiResponse> {
  try {
    const response = await stocksApi.post('/kyc/bank-details', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid bank details');
    } else if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to server. Please check your connection');
    }
    throw new Error('Failed to verify bank details. Please try again');
  }
}

/**
 * Upload KYC document
 */
export async function uploadDocument(documentType: string, file: File): Promise<KycApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await stocksApi.post(`/kyc/upload-document/${documentType}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Upload document error:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid file');
    } else if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to server. Please check your connection');
    }
    throw new Error('Failed to upload document. Please try again');
  }
}

/**
 * Submit KYC for final review
 */
export async function submitKYC(): Promise<KycApiResponse> {
  try {
    const response = await stocksApi.post('/kyc/submit', { confirmationCheckbox: true });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Please complete all KYC steps');
    } else if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to server. Please check your connection');
    }
    throw new Error('Failed to submit KYC. Please try again');
  }
}

/**
 * Get KYC status
 */
export async function getKycStatus(): Promise<KycStatusResponse> {
  try {
    const response = await stocksApi.get('/kyc/status');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Unable to connect to server. Please check your connection');
    }
    throw new Error('Failed to fetch KYC status. Please try again');
  }
}
