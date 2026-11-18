/**
 * Cookie name constants — Edge-Runtime safe (no Node.js crypto dependency).
 *
 * This file is deliberately free of any Node.js-specific imports so that
 * Next.js middleware (which runs in the Edge Runtime) can import cookie
 * names without triggering "A Node.js module is loaded" warnings.
 *
 * @module cookie-crypto/constants
 */

// ============================================
// CONSTANTS
// ============================================

/**
 * Obfuscated cookie names used across the application for authentication.
 *
 * Cookie names are deliberately opaque so that someone inspecting browser
 * DevTools cannot identify which cookie serves which authentication purpose.
 * The `__s_` prefix is a short convention for "session/secret"; the suffix
 * is a short non-semantic identifier.
 *
 * Mapping (internal reference only — do NOT expose this in client code):
 *   __s_a1 → End-user auth token
 *   __s_a2 → Admin panel token
 *   __s_c1 → CMS panel token
 *   __s_s1 → Support panel token
 *   __s_r1 → RM panel token
 *   __s_m1 → Marketing panel token
 *   __s_a0 → Legacy admin token (read-only fallback)
 *
 * To add a new cookie: pick the next sequential suffix for the first-letter
 * group (e.g. a new support cookie → __s_s2) and add it here.
 */
export const OBFUSCATED_COOKIE_NAMES = {
  /** End-user JWT (phone-first / Google OAuth login) */
  AUTH_TOKEN: "__s_a1",
  AUTH_REFRESH_TOKEN: "__s_rfa1",

  /** Admin / Super Admin panel JWT */
  ADMIN_PANEL_TOKEN: "__s_a2",
  ADMIN_REFRESH_TOKEN: "__s_rfa2",

  /** Content Manager panel JWT */
  CMS_PANEL_TOKEN: "__s_c1",

  /** Support Agent panel JWT */
  SUPPORT_PANEL_TOKEN: "__s_s1",

  /** Internal RM panel JWT */
  INTERNAL_RM_PANEL_TOKEN: "__s_irm1",
  INTERNAL_RM_REFRESH_TOKEN: "__s_irmfr1",

  /** Distributor RM panel JWT */
  DISTRIBUTOR_RM_PANEL_TOKEN: "__s_drm1",
  DISTRIBUTOR_RM_REFRESH_TOKEN: "__s_drmfr1",

  /** Marketing Manager panel JWT */
  MARKETING_PANEL_TOKEN: "__s_m1",

  /** Distributor Panel JWT */
  DISTRIBUTOR_PANEL_TOKEN: "__s_d1",
  DISTRIBUTOR_REFRESH_TOKEN: "__s_rfd1",

  /** Branch Panel JWT */
  BRANCH_PANEL_TOKEN: "__s_b1",
  BRANCH_REFRESH_TOKEN: "__s_rfb1",

  /** Accounting Panel JWT */
  ACCOUNTING_PANEL_TOKEN: "__s_acc1",

  /** Operation Panel JWT */
  OPERATION_PANEL_TOKEN: "__s_o1",

  /**
   * Legacy admin cookie — read-only for backward compatibility.
   * This cookie is never set by current code but may still exist
   * in older browser sessions. JWT strategies check it as a fallback.
   */
  ADMIN_TOKEN_LEGACY: "__s_a0",
} as const;

/**
 * Original (human-readable) cookie names, before obfuscation.
 *
 * During the migration window (up to 7 days — the max cookie lifetime),
 * JWT strategies should also check these original names so that users who
 * authenticated before the rename are not forcibly logged out.
 * After the migration window passes, these can be removed.
 */
export const ORIGINAL_COOKIE_NAMES = {
  AUTH_TOKEN: "auth_token",
  AUTH_REFRESH_TOKEN: "auth_refresh_token",
  ADMIN_PANEL_TOKEN: "admin_panel_token",
  ADMIN_REFRESH_TOKEN: "admin_refresh_token",
  CMS_PANEL_TOKEN: "cms_panel_token",
  SUPPORT_PANEL_TOKEN: "support_panel_token",
  INTERNAL_RM_PANEL_TOKEN: "internal_rm_panel_token",
  INTERNAL_RM_REFRESH_TOKEN: "internal_rm_refresh_token",
  DISTRIBUTOR_RM_PANEL_TOKEN: "distributor_rm_panel_token",
  DISTRIBUTOR_RM_REFRESH_TOKEN: "distributor_rm_refresh_token",
  MARKETING_PANEL_TOKEN: "marketing_panel_token",
  DISTRIBUTOR_PANEL_TOKEN: "distributor_panel_token",
  DISTRIBUTOR_REFRESH_TOKEN: "distributor_refresh_token",
  BRANCH_PANEL_TOKEN: "branch_panel_token",
  BRANCH_REFRESH_TOKEN: "branch_refresh_token",
  ACCOUNTING_PANEL_TOKEN: "accounting_token",
  OPERATION_PANEL_TOKEN: "operation_token",
  ADMIN_TOKEN_LEGACY: "admin_token",
} as const;

/**
 * Shared role configuration for panel access.
 * Imported by both frontend middleware and backend API guards to ensure
 * role constraints stay perfectly synchronized across the system.
 */
export const PANEL_ROLE_CONFIG = {
  ADMIN: ["ADMIN", "SUPER_ADMIN"],
  CMS: ["CONTENT_MANAGER", "SUPER_ADMIN"],
  SUPPORT: ["SUPPORT_AGENT", "SUPER_ADMIN"],
  MARKETING: ["MARKETING_MANAGER", "SUPER_ADMIN", "SALES_EMPLOYEE"],
  ACCOUNTING: ["ACCOUNTANT", "SUPER_ADMIN"],
  OPERATION: ["OPERATIONS", "SUPER_ADMIN"],
} as const;

