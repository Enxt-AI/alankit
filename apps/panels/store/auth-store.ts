import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { Admin, AdminRole } from "../types/admin";
// NOTE: RelationshipManager import removed as part of RM system deprecation.
import {
  adminLogin as adminLoginApi,
  cmsLogin as cmsLoginApi,
  cmsVerifyOtp as cmsVerifyOtpApi,
  adminLogout as adminLogoutApi,
  cmsLogout as cmsLogoutApi,
  supportLogin as supportLoginApi,
  supportLogout as supportLogoutApi,
  // NOTE: rmLogin/rmLogout imports removed as part of RM system deprecation.
  marketingLogin as marketingLoginApi,
  marketingLogout as marketingLogoutApi,
  accountingLogin as accountingLoginApi,
  accountingLogout as accountingLogoutApi,
  operationLogin as operationLoginApi,
  operationLogout as operationLogoutApi,
} from "../lib/auth-api";
import { sanitizeErrorMessage } from "../lib/error-utils";

interface AuthStore {
  // Admin authentication state
  admin: Admin | null;
  adminRole: AdminRole | null;
  permissions: string[];
  isAdminLoading: boolean;
  adminError: string | null;
  isLoggingOutAdmin: boolean;

  // CMS authentication state
  cmsAdmin: Admin | null;
  isCMSLoading: boolean;
  cmsError: string | null;
  isLoggingOut: boolean;
  hadCmsSession: boolean;

  // Support authentication state
  supportAdmin: Admin | null;
  isSupportLoading: boolean;
  supportError: string | null;
  isLoggingOutSupport: boolean;
  hadSupportSession: boolean;

  // NOTE: RM authentication state removed as part of RM system deprecation.

  // Marketing authentication state
  marketingAdmin: Admin | null;
  isMarketingLoading: boolean;
  marketingError: string | null;
  isLoggingOutMarketing: boolean;
  hadMarketingSession: boolean;

  // Accounting authentication state
  accountingAdmin: Admin | null;
  isAccountingLoading: boolean;
  accountingError: string | null;
  isLoggingOutAccounting: boolean;
  hadAccountingSession: boolean;

  // Operation authentication state
  operationAdmin: Admin | null;
  isOperationLoading: boolean;
  operationError: string | null;
  isLoggingOutOperation: boolean;
  hadOperationSession: boolean;

  // Admin authentication actions
  adminLogin: (email: string, password: string) => Promise<void>;
  adminLogout: () => Promise<void>;
  logoutAdmin: () => Promise<void>; // Alias for adminLogout
  setAdmin: (admin: Admin | null) => void;
  setAdminLoading: (loading: boolean) => void;
  setAdminError: (error: string | null) => void;

  // CMS authentication actions
  cmsLogin: (email: string, password: string) => Promise<{ requiresOtp: boolean } | void>;
  cmsVerifyOtp: (email: string, password: string, otp: string) => Promise<void>;
  cmsLogout: () => Promise<any>;
  setCMSAdmin: (admin: Admin | null) => void;
  setCMSLoading: (loading: boolean) => void;
  setCMSError: (error: string | null) => void;
  setIsLoggingOut: (isLoggingOut: boolean) => void;
  setHadCmsSession: (hadCmsSession: boolean) => void;

  // Support authentication actions
  supportLogin: (email: string, password: string) => Promise<void>;
  supportLogout: () => Promise<any>;
  setSupportAdmin: (admin: Admin | null) => void;
  setSupportLoading: (loading: boolean) => void;
  setSupportError: (error: string | null) => void;
  setIsLoggingOutSupport: (isLoggingOut: boolean) => void;
  setHadSupportSession: (hadSupportSession: boolean) => void;

  // NOTE: RM authentication actions removed as part of RM system deprecation.

  // Marketing authentication actions
  marketingLogin: (email: string, password: string) => Promise<void>;
  marketingLogout: () => Promise<any>;
  setMarketingAdmin: (admin: Admin | null) => void;
  setMarketingLoading: (loading: boolean) => void;
  setMarketingError: (error: string | null) => void;
  setIsLoggingOutMarketing: (isLoggingOut: boolean) => void;
  setHadMarketingSession: (hadMarketingSession: boolean) => void;

  // Accounting authentication actions
  accountingLogin: (email: string, password: string) => Promise<void>;
  accountingLogout: () => Promise<any>;
  setAccountingAdmin: (admin: Admin | null) => void;
  setAccountingLoading: (loading: boolean) => void;
  setAccountingError: (error: string | null) => void;
  setIsLoggingOutAccounting: (isLoggingOut: boolean) => void;
  setHadAccountingSession: (hadAccountingSession: boolean) => void;

  // Operation authentication actions
  operationLogin: (email: string, password: string) => Promise<void>;
  operationLogout: () => Promise<any>;
  setOperationAdmin: (admin: Admin | null) => void;
  setOperationLoading: (loading: boolean) => void;
  setOperationError: (error: string | null) => void;
  setIsLoggingOutOperation: (isLoggingOut: boolean) => void;
  setHadOperationSession: (hadOperationSession: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Admin authentication state
  admin: null,
  adminRole: null,
  permissions: [],
  isAdminLoading: true,
  adminError: null,
  isLoggingOutAdmin: false,

  // CMS authentication state
  cmsAdmin: null,
  isCMSLoading: true,
  cmsError: null,
  isLoggingOut: false,
  hadCmsSession: false,

  // Support authentication state
  supportAdmin: null,
  isSupportLoading: true,
  supportError: null,
  isLoggingOutSupport: false,
  hadSupportSession: false,

  // NOTE: RM authentication state defaults removed as part of RM system deprecation.

  // Marketing authentication state
  marketingAdmin: null,
  isMarketingLoading: true,
  marketingError: null,
  isLoggingOutMarketing: false,
  hadMarketingSession: false,

  // Accounting authentication state
  accountingAdmin: null,
  isAccountingLoading: true,
  accountingError: null,
  isLoggingOutAccounting: false,
  hadAccountingSession: false,

  // Operation authentication state
  operationAdmin: null,
  isOperationLoading: true,
  operationError: null,
  isLoggingOutOperation: false,
  hadOperationSession: false,

  // Admin authentication actions
  adminLogin: async (email, password) => {
    set({ isAdminLoading: true, adminError: null });
    try {
      const response = await adminLoginApi(email, password);

      const admin = response?.admin || (response as any)?.user;
      if (!admin?.id) {
        throw new Error((response as any)?.message || "Invalid email or password");
      }

      const adminUser: Admin = {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        admin: adminUser,
        adminRole: adminUser.role,
        permissions: adminUser.permissions,
        isAdminLoading: false,
        adminError: null,
      });
    } catch (error: any) {
      set({
        adminError: sanitizeErrorMessage(error, "Invalid email or password. Please try again."),
        isAdminLoading: false,
      });
      throw error;
    }
  },

  adminLogout: async () => {
    set({ isLoggingOutAdmin: true });
    try {
      await adminLogoutApi();
    } catch {
      // logout should be best-effort; treat as success client-side
    }
    set({
      admin: null,
      adminRole: null,
      permissions: [],
      adminError: null,
    });
    // Keep the logout flag true long enough for client navigation/redirect to complete.
    setTimeout(() => set({ isLoggingOutAdmin: false }), 3000);
  },

  logoutAdmin: async () => {
    await get().adminLogout();
  },

  setAdmin: (admin) => {
    if (admin) {
      set({
        admin,
        adminRole: admin.role,
        permissions: admin.permissions,
      });
      return;
    }

    set({
      admin: null,
      adminRole: null,
      permissions: [],
    });
  },

  setAdminLoading: (loading) => set({ isAdminLoading: loading }),
  setAdminError: (error) => set({ adminError: error }),

  // CMS authentication actions
  cmsLogin: async (email, password) => {
    set({ isCMSLoading: true, cmsError: null });
    try {
      const response = await cmsLoginApi(email, password);

      if (response.requiresOtp) {
        set({ isCMSLoading: false });
        return { requiresOtp: true };
      }

      if (!response.admin || (response.admin.role !== "CONTENT_MANAGER" && response.admin.role !== "SUPER_ADMIN")) {
        throw new Error("Access denied. Content Manager or Super Admin role required.");
      }

      const adminUser: Admin = {
        id: response.admin.id,
        email: response.admin.email,
        fullName: response.admin.fullName,
        role: response.admin.role,
        permissions: response.admin.permissions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        cmsAdmin: adminUser,
        isCMSLoading: false,
        cmsError: null,
      });
    } catch (error: any) {
      set({
        cmsError: sanitizeErrorMessage(error, "Invalid email or password. Please try again."),
        isCMSLoading: false,
      });
      throw error;
    }
  },

  cmsVerifyOtp: async (email, password, otp) => {
    set({ isCMSLoading: true, cmsError: null });
    try {
      const response = await cmsVerifyOtpApi(email, password, otp);

      const admin = response?.admin || (response as any)?.user;
      if (!admin?.id) {
        throw new Error((response as any)?.message || "Invalid OTP code");
      }

      if (admin.role !== "CONTENT_MANAGER" && admin.role !== "SUPER_ADMIN") {
        throw new Error("Access denied. Content Manager or Super Admin role required.");
      }

      const adminUser: Admin = {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        cmsAdmin: adminUser,
        isCMSLoading: false,
        cmsError: null,
      });
    } catch (error: any) {
      set({
        cmsError: sanitizeErrorMessage(error, "Invalid OTP code. Please try again."),
        isCMSLoading: false,
      });
      throw error;
    }
  },

  cmsLogout: async () => {
    set({ isLoggingOut: true });
    try {
      await cmsLogoutApi();
      set({
        cmsAdmin: null,
        cmsError: null,
      });
      setTimeout(() => set({ isLoggingOut: false }), 3000);
      return { success: true };
    } catch {
      set({
        cmsAdmin: null,
        cmsError: null,
      });
      setTimeout(() => set({ isLoggingOut: false }), 3000);
      return { success: true };
    }
  },

  setCMSAdmin: (admin) => {
    set({
      cmsAdmin: admin,
      hadCmsSession: admin !== null,
    });
  },
  setCMSLoading: (loading) => set({ isCMSLoading: loading }),
  setCMSError: (error) => set({ cmsError: error }),
  setIsLoggingOut: (isLoggingOut) => set({ isLoggingOut }),
  setHadCmsSession: (hadCmsSession) => set({ hadCmsSession }),

  // Support authentication actions
  supportLogin: async (email, password) => {
    set({ isSupportLoading: true, supportError: null });
    try {
      const response = await supportLoginApi(email, password);

      const admin = response?.admin || (response as any)?.user;
      if (!admin?.id) {
        throw new Error((response as any)?.message || "Invalid email or password");
      }

      if (admin.role !== "SUPPORT_AGENT" && admin.role !== "SUPER_ADMIN") {
        throw new Error("Access denied. Support Agent or Super Admin role required.");
      }

      const adminUser: Admin = {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        supportAdmin: adminUser,
        isSupportLoading: false,
        supportError: null,
      });
    } catch (error: any) {
      set({
        supportError: sanitizeErrorMessage(error, "Invalid email or password. Please try again."),
        isSupportLoading: false,
      });
      throw error;
    }
  },

  supportLogout: async () => {
    set({ isLoggingOutSupport: true });
    try {
      await supportLogoutApi();
      set({
        supportAdmin: null,
        supportError: null,
      });
      setTimeout(() => set({ isLoggingOutSupport: false }), 3000);
      return { success: true };
    } catch {
      set({
        supportAdmin: null,
        supportError: null,
      });
      setTimeout(() => set({ isLoggingOutSupport: false }), 3000);
      return { success: true };
    }
  },

  setSupportAdmin: (admin) => {
    set({
      supportAdmin: admin,
      hadSupportSession: admin !== null,
    });
  },
  setSupportLoading: (loading) => set({ isSupportLoading: loading }),
  setSupportError: (error) => set({ supportError: error }),
  setIsLoggingOutSupport: (isLoggingOut) => set({ isLoggingOutSupport: isLoggingOut }),
  setHadSupportSession: (hadSupportSession) => set({ hadSupportSession }),

  // NOTE: RM authentication actions removed as part of RM system deprecation.

  // Marketing authentication actions
  marketingLogin: async (email, password) => {
    set({ isMarketingLoading: true, marketingError: null });
    try {
      const response = await marketingLoginApi(email, password);

      const admin = response?.admin || (response as any)?.user;
      if (!admin?.id) {
        throw new Error((response as any)?.message || "Invalid email or password");
      }

      if (admin.role !== "MARKETING_MANAGER" && admin.role !== "SUPER_ADMIN" && admin.role !== "SALES_EMPLOYEE") {
        throw new Error("Access denied. Marketing Manager or Super Admin role required.");
      }

      const adminUser: Admin = {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        marketingAdmin: adminUser,
        isMarketingLoading: false,
        marketingError: null,
      });
    } catch (error: any) {
      set({
        marketingError: sanitizeErrorMessage(error, "Invalid email or password. Please try again."),
        isMarketingLoading: false,
      });
      throw error;
    }
  },

  marketingLogout: async () => {
    set({ isLoggingOutMarketing: true });
    try {
      await marketingLogoutApi();
      set({
        marketingAdmin: null,
        marketingError: null,
      });
      setTimeout(() => set({ isLoggingOutMarketing: false }), 3000);
      return { success: true };
    } catch {
      set({
        marketingAdmin: null,
        marketingError: null,
      });
      setTimeout(() => set({ isLoggingOutMarketing: false }), 3000);
      return { success: true };
    }
  },

  setMarketingAdmin: (admin) => {
    set({
      marketingAdmin: admin,
      hadMarketingSession: admin !== null,
    });
  },
  setMarketingLoading: (loading) => set({ isMarketingLoading: loading }),
  setMarketingError: (error) => set({ marketingError: error }),
  setIsLoggingOutMarketing: (isLoggingOut) => set({ isLoggingOutMarketing: isLoggingOut }),
  setHadMarketingSession: (hadMarketingSession) => set({ hadMarketingSession }),

  // Accounting authentication actions
  accountingLogin: async (email, password) => {
    set({ isAccountingLoading: true, accountingError: null });
    try {
      const response = await accountingLoginApi(email, password);

      const admin = response?.admin || (response as any)?.user;
      if (!admin?.id) {
        throw new Error((response as any)?.message || "Invalid email or password");
      }

      if (admin.role !== "ACCOUNTANT" && admin.role !== "SUPER_ADMIN") {
        throw new Error("Access denied. Accountant or Super Admin role required.");
      }

      const adminUser: Admin = {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        accountingAdmin: adminUser,
        isAccountingLoading: false,
        accountingError: null,
      });
    } catch (error: any) {
      set({
        accountingError: sanitizeErrorMessage(error, "Invalid email or password. Please try again."),
        isAccountingLoading: false,
      });
      throw error;
    }
  },

  accountingLogout: async () => {
    set({ isLoggingOutAccounting: true });
    try {
      await accountingLogoutApi();
      set({
        accountingAdmin: null,
        accountingError: null,
      });
      setTimeout(() => set({ isLoggingOutAccounting: false }), 3000);
      return { success: true };
    } catch {
      set({
        accountingAdmin: null,
        accountingError: null,
      });
      setTimeout(() => set({ isLoggingOutAccounting: false }), 3000);
      return { success: true };
    }
  },

  setAccountingAdmin: (admin) => {
    set({
      accountingAdmin: admin,
      hadAccountingSession: admin !== null,
    });
  },
  setAccountingLoading: (loading) => set({ isAccountingLoading: loading }),
  setAccountingError: (error) => set({ accountingError: error }),
  setIsLoggingOutAccounting: (isLoggingOut) => set({ isLoggingOutAccounting: isLoggingOut }),
  setHadAccountingSession: (hadAccountingSession) => set({ hadAccountingSession }),

  // Operation authentication actions
  operationLogin: async (email: string, password: string) => {
    set({ isOperationLoading: true, operationError: null });
    try {
      const response = await operationLoginApi(email, password);

      const admin = response?.admin || (response as any)?.user;
      if (!admin?.id) {
        throw new Error((response as any)?.message || "Invalid email or password");
      }

      if (admin.role !== "OPERATIONS" && admin.role !== "SUPER_ADMIN") {
        throw new Error("Access denied. Operations or Super Admin role required.");
      }

      const adminUser: Admin = {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set({
        operationAdmin: adminUser,
        isOperationLoading: false,
        operationError: null,
      });
    } catch (error: any) {
      set({
        operationError: sanitizeErrorMessage(error, "Invalid email or password. Please try again."),
        isOperationLoading: false,
      });
      throw error;
    }
  },

  operationLogout: async () => {
    set({ isLoggingOutOperation: true });
    try {
      await operationLogoutApi();
      set({
        operationAdmin: null,
        operationError: null,
      });
      setTimeout(() => set({ isLoggingOutOperation: false }), 3000);
      return { success: true };
    } catch {
      set({
        operationAdmin: null,
        operationError: null,
      });
      setTimeout(() => set({ isLoggingOutOperation: false }), 3000);
      return { success: true };
    }
  },

  setOperationAdmin: (admin: Admin | null) => {
    set({
      operationAdmin: admin,
      hadOperationSession: admin !== null,
    });
  },
  setOperationLoading: (loading: boolean) => set({ isOperationLoading: loading }),
  setOperationError: (error: string | null) => set({ operationError: error }),
  setIsLoggingOutOperation: (isLoggingOut: boolean) => set({ isLoggingOutOperation: isLoggingOut }),
  setHadOperationSession: (hadOperationSession: boolean) => set({ hadOperationSession }),
}));

export const useCMSAdmin = () =>
  useAuthStore(useShallow((state) => ({
    cmsAdmin: state.cmsAdmin,
    isCMSLoading: state.isCMSLoading,
    cmsError: state.cmsError,
  })));

export const useSupportAdmin = () =>
  useAuthStore(useShallow((state) => ({
    supportAdmin: state.supportAdmin,
    isSupportLoading: state.isSupportLoading,
    supportError: state.supportError,
  })));

export const useMarketingAdmin = () =>
  useAuthStore(useShallow((state) => ({
    marketingAdmin: state.marketingAdmin,
    isMarketingLoading: state.isMarketingLoading,
    marketingError: state.marketingError,
  })));

export const useAccountingAdmin = () =>
  useAuthStore(useShallow((state) => ({
    accountingAdmin: state.accountingAdmin,
    isAccountingLoading: state.isAccountingLoading,
    accountingError: state.accountingError,
  })));

export const useOperationAdmin = () =>
  useAuthStore(useShallow((state) => ({
    operationAdmin: state.operationAdmin,
    isOperationLoading: state.isOperationLoading,
    operationError: state.operationError,
  })));
