import { create } from "zustand";

// @ts-ignore - Assuming types will be resolved from shared package
import type { User } from "../../../apps/web/types/user";
import {
  logout as logoutApi,
  requestOTP as requestOTPApi,
  verifyOTP as verifyOTPApi,
  getUserProfile,
  phoneOtpRequest as phoneOtpRequestApi,
  phoneOtpVerify as phoneOtpVerifyApi,
  emailOtpRequest as emailOtpRequestApi,
  emailOtpVerify as emailOtpVerifyApi,
  updateProfile as updateProfileApi,
  setMobileAuthToken,
} from "@repo/api";

function profileToUser(profile: any): User {
  return {
    id: profile.id,
    email: profile.email ?? null,
    fullName: profile.fullName ?? null,
    phone: profile.phone ?? null,
    kycStatus: profile.kycStatus ?? "PENDING",
    currentStep: profile.currentStep ?? 0,
    kycData: profile.kycData ?? null,
    kycDocuments: profile.kycDocuments ?? null,
    dematStatus: profile.dematStatus ?? "PENDING",
    dematData: profile.dematData ?? null,
    dematDocuments: profile.dematDocuments ?? null,
    bankStatus: profile.bankStatus ?? "PENDING",
    bankData: profile.bankData ?? null,
    createdAt: profile.createdAt ?? new Date().toISOString(),
    updatedAt: profile.updatedAt ?? new Date().toISOString(),
  };
}

interface AuthStore {
  // Modal state
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  toggleAuthModal: () => void;

  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // OTP state
  otpStep: "idle" | "phone" | "otp";
  otpMobile: string | null;

  // Phone-first auth state
  needsEmail: boolean;
  tempPhone: string | null;
  phoneOtpDeliveryMessage: string | null;
  phoneOtpSmsSent: boolean | null;
  phoneOtpDevFallbackAvailable: boolean | null;
  cooldownUntil: number | null;
  checkOtpStatus: (phone: string) => Promise<boolean>;

  // Email OTP state
  tempEmail: string | null;
  emailOtpStep: "idle" | "otp" | "name-input";
  emailOtpMessage: string | null;

  // User actions
  logout: () => void;
  refetchUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // OTP actions (legacy, JWT-protected)
  requestOTP: (mobile: string) => Promise<void>;
  verifyOTP: (mobile: string, otp: string) => Promise<void>;
  setOTPStep: (step: "idle" | "phone" | "otp") => void;
  setOTPMobile: (mobile: string | null) => void;
  resetOTPFlow: () => void;

  // Phone-first actions
  phoneOtpRequest: (phone: string, captchaToken?: string) => Promise<{
    success: boolean;
    message: string;
    smsSent?: boolean;
    devFallbackAvailable?: boolean;
    providerCode?: number;
    captchaRequired?: boolean;
  }>;
  phoneOtpVerify: (phone: string, otp: string) => Promise<void>;
  setNeedsEmail: (needs: boolean) => void;
  setTempPhone: (phone: string | null) => void;
  wasDeactivated: boolean;
  setWasDeactivated: (was: boolean) => void;

  // Email OTP actions
  emailOtpRequest: (email: string, captchaToken?: string) => Promise<{ success: boolean; message: string; captchaRequired?: boolean }>;
  emailOtpVerify: (email: string, otp: string, phone?: string) => Promise<void>;
  setTempEmail: (email: string | null) => void;
  updateProfile: (data: { fullName: string }) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Modal state
  isAuthModalOpen: false,
  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  toggleAuthModal: () =>
    set((state) => ({ isAuthModalOpen: !state.isAuthModalOpen })),

  // Authentication state
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  // OTP state
  otpStep: "idle",
  otpMobile: null,

  // Phone-first state
  needsEmail: false,
  tempPhone: null,
  phoneOtpDeliveryMessage: null,
  phoneOtpSmsSent: null,
  phoneOtpDevFallbackAvailable: null,
  cooldownUntil: null,
  wasDeactivated: false,
  setWasDeactivated: (was) => set({ wasDeactivated: was }),

  // Email OTP state
  tempEmail: null,
  emailOtpStep: "idle",
  emailOtpMessage: null,

  // User actions

  logout: () => {
    void logoutApi();
    setMobileAuthToken(null);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      otpStep: 'idle',
      otpMobile: null,
      needsEmail: false,
      tempPhone: null,
      tempEmail: null,
      emailOtpStep: "idle",
      emailOtpMessage: null,
      phoneOtpDeliveryMessage: null,
      phoneOtpSmsSent: null,
      phoneOtpDevFallbackAvailable: null,
    });
  },

  refetchUser: async () => {
    try {
      const TIMEOUT_MS = 8_000;
      const profile = await Promise.race([
        getUserProfile(),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            resolve(null);
          }, TIMEOUT_MS),
        ),
      ]);

      if (!profile || profile.type !== "USER") {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      set({
        user: profileToUser(profile),
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      if (process.env.NEXT_PUBLIC_DEBUG_AUTH === "true") {
        console.error("[Auth Store] Failed to refetch user profile:", error);
      }
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: user !== null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // OTP actions (legacy, guarded)
  requestOTP: async (mobile) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      await requestOTPApi(mobile);
      set({
        otpStep: "otp",
        otpMobile: mobile,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error?.message || "Failed to send OTP", isLoading: false });
      throw error;
    }
  },

  verifyOTP: async (mobile, otp) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const response = await verifyOTPApi(mobile, otp);
      if ((response as any).token) {
        setMobileAuthToken((response as any).token);
      }
      await get().refetchUser();
      set({ otpStep: "idle", otpMobile: null });
    } catch (error: any) {
      set({ error: error?.message || "Failed to verify OTP", isLoading: false });
      throw error;
    }
  },

  setOTPStep: (step) => set({ otpStep: step }),
  setOTPMobile: (mobile) => set({ otpMobile: mobile }),
  resetOTPFlow: () =>
    set({
      otpStep: "idle",
      otpMobile: null,
      error: null,
      phoneOtpDeliveryMessage: null,
      phoneOtpSmsSent: null,
      phoneOtpDevFallbackAvailable: null,
    }),

  // Phone-first actions (public)
  checkOtpStatus: async (phone: string) => {
    try {
      const { getPhoneOtpStatus } = await import("@repo/api");
      const status = await getPhoneOtpStatus(phone);
      if (status.hasActiveOTP) {
        set({
          otpStep: "otp",
          tempPhone: phone,
          cooldownUntil: status.cooldownUntil || null,
          phoneOtpDeliveryMessage: status.cooldownActive
            ? `Code already sent. You can request a new one in ${status.cooldownRemainingSeconds}s.`
            : "An OTP is currently active for this number.",
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  phoneOtpRequest: async (phone, captchaToken) => {
    if (get().isLoading) return { success: false, message: "A request is already in progress." };
    set({ isLoading: true, error: null });
    try {
      const result = await phoneOtpRequestApi(phone, captchaToken);
      if (result.captchaRequired) {
        set({ isLoading: false });
        return result;
      }

      // Persist active phone in localStorage for seamless return across reloads
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("unlistedstox_active_otp_phone", phone);
        } catch (e) {}
      }

      const cooldownUntil = result.cooldownUntil || (result.cooldownRemainingSeconds ? Date.now() + result.cooldownRemainingSeconds * 1000 : Date.now() + 30000);

      set({
        otpStep: "otp",
        tempPhone: phone,
        isLoading: false,
        cooldownUntil,
        phoneOtpDeliveryMessage: result.message || null,
        phoneOtpSmsSent:
          typeof result.smsSent === "boolean" ? result.smsSent : null,
        phoneOtpDevFallbackAvailable:
          typeof result.devFallbackAvailable === "boolean"
            ? result.devFallbackAvailable
            : null,
      });
      return result;
    } catch (error: any) {
      if (error?.message?.includes("CAPTCHA") || error?.response?.data?.captchaRequired) {
        set({ isLoading: false });
        return { success: false, captchaRequired: true, message: error.message };
      }
      set({ error: error?.message || "Failed to send OTP", isLoading: false });
      throw error;
    }
  },

  phoneOtpVerify: async (phone, otp) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });

    try {
      const response = await phoneOtpVerifyApi(phone, otp);

      if ((response as any).token) {
        setMobileAuthToken((response as any).token);
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("unlistedstox_active_otp_phone");
        } catch (e) {}
      }

      if (response.wasDeactivated) {
        set({ wasDeactivated: true });
      }

      if (response.needsEmail) {
        // Phone-only user — needs email linking (signup step 2)
        set({
          needsEmail: true,
          tempPhone: phone,
          otpStep: "idle",
          otpMobile: null,
          isLoading: false,
        });
        return;
      }

      // Existing user with email — hydrate profile
      await get().refetchUser();

      set({
        needsEmail: false,
        tempPhone: null,
        otpStep: "idle",
        otpMobile: null,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error?.message || "Failed to verify OTP", isLoading: false });
      throw error;
    }
  },

  setNeedsEmail: (needs) => set({ needsEmail: needs }),
  setTempPhone: (phone) => set({ tempPhone: phone }),

  // Email OTP actions
  emailOtpRequest: async (email, captchaToken) => {
    if (get().isLoading) return { success: false, message: "A request is already in progress." };
    set({ isLoading: true, error: null });
    try {
      const result = await emailOtpRequestApi(email, captchaToken);
      if ((result as any).captchaRequired) {
        set({ isLoading: false });
        return result;
      }
      set({
        emailOtpStep: "otp",
        tempEmail: email,
        isLoading: false,
        emailOtpMessage: result.message || null,
      });
      return result;
    } catch (error: any) {
      if (error?.message?.includes("CAPTCHA") || error?.response?.data?.captchaRequired) {
        set({ isLoading: false });
        return { success: false, captchaRequired: true, message: error.message };
      }
      set({ error: error?.message || "Failed to send OTP", isLoading: false });
      throw error;
    }
  },

  emailOtpVerify: async (email, otp, phone?) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const response = await emailOtpVerifyApi(email, otp, phone);

      if ((response as any).token) {
        setMobileAuthToken((response as any).token);
      }

      if (response.wasDeactivated) {
        set({ wasDeactivated: true });
      }

      // Cookie is set by backend; hydrate user profile
      await get().refetchUser();
      const profile = get().user;

      // If it's a new signup or name is empty/default, go to name-input
      if (response?.isNewUser || !profile?.fullName || profile.fullName === email.split('@')[0]) {
        set({
          emailOtpStep: "name-input",
          isLoading: false,
        });
        return;
      }

      set({
        emailOtpStep: "idle",
        tempEmail: null,
        emailOtpMessage: null,
        needsEmail: false,
        tempPhone: null,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error?.message || "Failed to verify OTP", isLoading: false });
      throw error;
    }
  },

  updateProfile: async (data: { fullName: string }) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      await updateProfileApi(data);
      await get().refetchUser();

      set({
        emailOtpStep: "idle",
        tempEmail: null,
        emailOtpMessage: null,
        needsEmail: false,
        tempPhone: null,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error?.message || "Failed to update profile", isLoading: false });
      throw error;
    }
  },

  setTempEmail: (email) => set({ tempEmail: email }),
}));
