import { User } from './user';

export interface GoogleAuthResponse {
  success: boolean;
  currentStep: number;
  kycStatus: string;
  token: string;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  token?: string;
  currentStep?: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (googleData: { email: string; name: string; googleId: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
  clientId: string;
}
