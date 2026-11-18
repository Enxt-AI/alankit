import { authApi } from "./api-client";
import { sanitizeErrorMessage } from "./error-utils";

import type { OTPResponse } from "../types/auth";
import type { User } from "../types/user";

// ================================
// USER AUTH (auth-service)
// Cookie-only: backend sets HttpOnly `auth_token`.
// ================================

function extractErrorMessage(error: any, fallback: string): string {
  return sanitizeErrorMessage(error, fallback);
}


export async function logout(): Promise<void> {
  try {
    if (typeof window !== "undefined" && typeof fetch !== "undefined") {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      });
    } else {
      await authApi.post("/auth/signout");
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Logout error:", error);
    }
  }
}

export async function requestOTP(mobile: string, captchaToken?: string): Promise<OTPResponse> {
  const idKey = `req-legacy-${mobile}-${Math.random().toString(36).substring(2, 10)}`;
  try {
    const response = await authApi.post<OTPResponse>(
      "/auth/otp",
      { mobile, captchaToken },
      { headers: { "x-idempotency-key": idKey } }
    );
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 401) {
      throw new Error("Unauthorized. Please verify your phone or email.");
    }
    if (error?.response?.status === 400) {
      throw new Error(extractErrorMessage(error, "Invalid mobile number format"));
    }
    if (!error?.response) {
      throw new Error("Failed to send OTP. Please check your connection.");
    }
    throw new Error(extractErrorMessage(error, "Failed to send OTP"));
  }
}

export async function verifyOTP(mobile: string, otp: string): Promise<OTPResponse> {
  try {
    let publicKey = undefined;
    if (typeof window !== "undefined") {
      try {
        const { getDPoPPublicKeySPKI } = await import("./dpop");
        publicKey = await getDPoPPublicKeySPKI();
      } catch (e) {
        // Ignore if unsupported
      }
    }
    const response = await authApi.post<OTPResponse>("/auth/otp/verify", {
      mobile,
      otp,
      ...(publicKey ? { publicKey } : {}),
    });
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }
    if (error?.response?.status === 400) {
      throw new Error(extractErrorMessage(error, "Invalid OTP"));
    }
    if (!error?.response) {
      throw new Error("Failed to verify OTP. Please try again.");
    }
    throw new Error(extractErrorMessage(error, "Failed to verify OTP"));
  }
}

export async function getUserProfile(): Promise<any | null> {
  try {
    const response = await authApi.get("/auth/profile");
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 401) {
      return null;
    }

    console.error("Failed to fetch user profile:", error);
    throw error;
  }
}

// ================================
// PHONE-FIRST AUTH (auth-service)
// Cookie-only when applicable: backend sets HttpOnly `auth_token`.
// ================================

export async function getPhoneOtpStatus(phone: string): Promise<{
  hasActiveOTP: boolean;
  cooldownActive: boolean;
  cooldownRemainingSeconds: number;
  cooldownUntil: number | null;
  expiresAt?: number | null;
  deliveryStatus?: string;
}> {
  try {
    const response = await authApi.get("/auth/phone/otp/status", {
      params: { phone },
    });
    return response.data;
  } catch (error) {
    return {
      hasActiveOTP: false,
      cooldownActive: false,
      cooldownRemainingSeconds: 0,
      cooldownUntil: null,
    };
  }
}

export async function phoneOtpRequest(phone: string, captchaToken?: string): Promise<{
  success: boolean;
  message: string;
  smsSent?: boolean;
  devFallbackAvailable?: boolean;
  providerCode?: number;
  captchaRequired?: boolean;
  activeSession?: boolean;
  cooldownActive?: boolean;
  cooldownRemainingSeconds?: number;
  cooldownUntil?: number | null;
}> {
  const idKey = `req-phone-${phone}-${Math.random().toString(36).substring(2, 10)}`;
  try {
    const response = await authApi.post(
      "/auth/phone/otp/request",
      { phone, captchaToken },
      { headers: { "x-idempotency-key": idKey } }
    );
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 429) {
      throw new Error(extractErrorMessage(error, "Too many OTP requests. Try again in 2 minutes."));
    }

    if (error?.response?.status === 400) {
      throw new Error(extractErrorMessage(error, "Invalid phone number"));
    }

    if (!error?.response) {
      throw new Error("Failed to send OTP. Please check your connection.");
    }

    throw new Error(extractErrorMessage(error, "Failed to send OTP"));
  }
}

export async function phoneOtpVerify(
  phone: string,
  otp: string,
): Promise<{ user?: User; needsEmail: boolean; token?: string; wasDeactivated?: boolean }> {
  try {
    let publicKey = undefined;
    if (typeof window !== "undefined") {
      try {
        const { getDPoPPublicKeySPKI } = await import("./dpop");
        publicKey = await getDPoPPublicKeySPKI();
      } catch (e) {
        // Ignore if unsupported
      }
    }
    const response = await authApi.post("/auth/phone/otp/verify", { phone, otp, publicKey });
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 400) {
      throw new Error(extractErrorMessage(error, "Invalid OTP or too many attempts"));
    }
    if (!error?.response) {
      throw new Error("Failed to verify OTP. Please try again.");
    }
    throw new Error(extractErrorMessage(error, "Failed to verify OTP"));
  }
}


// ================================
// EMAIL OTP AUTH (auth-service)
// New email-first authentication flow
// ================================

export async function emailOtpRequest(
  email: string,
  captchaToken?: string,
  phone?: string,
): Promise<{
  success: boolean;
  message: string;
  captchaRequired?: boolean;
}> {
  const idKey = `req-email-${email.replace(/[@.]/g, "-")}-${Math.random().toString(36).substring(2, 10)}`;
  try {
    const response = await authApi.post(
      "/auth/email/otp/request",
      { email, captchaToken, ...(phone ? { phone } : {}) },
      { headers: { "x-idempotency-key": idKey } }
    );
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 429) {
      throw new Error(extractErrorMessage(error, "Too many OTP requests. Try again in 2 minutes."));
    }

    if (error?.response?.status === 400) {
      throw new Error(extractErrorMessage(error, "Invalid email address"));
    }

    if (!error?.response) {
      throw new Error("Failed to send OTP. Please check your connection.");
    }

    throw new Error(extractErrorMessage(error, "Failed to send OTP"));
  }
}

export async function emailOtpVerify(
  email: string,
  otp: string,
  phone?: string,
): Promise<{ success: boolean; token?: string; isNewUser?: boolean; needsName?: boolean; wasDeactivated?: boolean }> {
  try {
    let publicKey = undefined;
    if (typeof window !== "undefined") {
      try {
        const { getDPoPPublicKeySPKI } = await import("./dpop");
        publicKey = await getDPoPPublicKeySPKI();
      } catch (e) {
        // Ignore if unsupported
      }
    }
    const response = await authApi.post("/auth/email/otp/verify", {
      email,
      otp,
      ...(phone ? { phone } : {}),
      ...(publicKey ? { publicKey } : {}),
    });
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 400) {
      throw new Error(extractErrorMessage(error, "Invalid OTP or too many attempts"));
    }
    if (!error?.response) {
      throw new Error("Failed to verify OTP. Please try again.");
    }
    throw new Error(extractErrorMessage(error, "Failed to verify OTP"));
  }
}

export async function updateProfile(data: { fullName: string }): Promise<{ success: boolean }> {
  try {
    const response = await authApi.post("/auth/profile", data);
    return response.data;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, "Failed to update profile"));
  }
}

export async function deactivateUserAccount(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await authApi.post("/auth/deactivate");
    return response.data;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, "Failed to deactivate account"));
  }
}

export async function deleteUserAccount(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await authApi.post("/auth/delete");
    return response.data;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, "Failed to delete account"));
  }
}

// ============================================
// SESSION MANAGEMENT API FUNCTIONS
// ============================================

export interface ActiveSession {
  id: string;
  portal: string;
  device: string;
  ip: string;
  loginTime: string | null;
  lastActive: string | null;
  expiresInSeconds: number | null;
  isCurrent: boolean;
}

export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  try {
    const response = await authApi.get('/auth/sessions');
    return response.data.sessions || [];
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch active sessions'));
  }
}

export async function terminateSession(sessionId: string): Promise<void> {
  try {
    await authApi.delete(`/auth/sessions/${sessionId}`);
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to terminate session'));
  }
}

export async function terminateAllOtherSessions(): Promise<{ message: string }> {
  try {
    const response = await authApi.post('/auth/sessions/terminate-others');
    return response.data;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to terminate other sessions'));
  }
}

export async function completeSignup(data: { fullName: string }): Promise<void> {
  try {
    let publicKey: string | undefined;
    try {
      const dpop = await import("./dpop");
      publicKey = await dpop.getDPoPPublicKeySPKI();
    } catch {
      // Match OTP verification: unsupported browser key storage must not prevent the request.
    }
    const response = await authApi.post("/auth/signup/complete", { ...data, ...(publicKey ? { publicKey } : {}) });
    if (response.data?.success !== true) {
      throw new Error("Signup was not completed. Please try again.");
    }
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, "Unable to complete signup. Please restart signup if it expired."));
  }
}

export async function getSignupStatus(): Promise<{ step: "phone" | "email" | "name"; phone?: string; email?: string }> {
  const response = await authApi.get("/auth/signup/status");
  return response.data;
}
