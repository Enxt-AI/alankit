export interface DocumentUpload {
  data: string; // base64 encoded data with mime type prefix
  fileName: string;
  fileSize: number;
}

export interface LinkDematRequest {
  accountNumber: string; // 16-digit BO ID
  dpId: string; // 8-digit DP ID
  clientId?: string; // Optional client ID
  dematStatement: DocumentUpload;
}

export interface CreateDematRequest {
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  panNumber: string;
  dematStatement: DocumentUpload;
  addressProof: DocumentUpload;
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

export interface DematStatusResponse {
  success: boolean;
  data: {
    dematStatus: string;
    kycVerified: boolean;
    dematData: DematData | null;
    documentsUploaded: {
      dematStatement: boolean;
      addressProof: boolean;
    };
    canLinkOrCreate: boolean;
  };
}

export interface DematApiResponse {
  success: boolean;
  message: string;
  data?: any;
}
