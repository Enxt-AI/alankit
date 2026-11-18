/**
 * Admin-related TypeScript types
 * Based on backend Admin model and API responses
 */

/**
 * Admin role type matching backend role values
 * Backend uses UPPERCASE: ADMIN, SUPER_ADMIN, CONTENT_MANAGER
 */
export type AdminRole = 'ADMIN' | 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'SUPPORT_AGENT' | 'ACCOUNTANT' | 'OPERATIONS' | 'MARKETING_MANAGER' | 'SALES_EMPLOYEE';

/**
 * Admin permission type - comprehensive union of all valid permission strings
 * Includes both legacy Milestone 1 permissions and new Milestone 2 CMS permissions
 */
export type AdminPermission =
  // Legacy permissions (Milestone 1)
  | 'manage_stocks'
  | 'update_orders'
  | 'manage_content'
  // NOTE: 'manage_referrals' permission removed as part of RM/referral system deprecation.
  | 'create_admins'
  | 'create_cms'
  | 'manage_faqs'
  // CMS permissions (Milestone 2)
  | 'cms_stocks'
  | 'cms_articles'
  | 'cms_news'
  | 'cms_faqs'
  | 'cms_static_pages'
  | 'cms_baskets'
  | 'cms_testimonials'
  | 'cms_carousel'
  | 'cms_demat_approval'
  // Admin permissions (Phase 5)
  | 'admin_stocks'
  | 'ADMIN_BASKETS'
  // Support permissions (Milestone 2 - Agent-Facing Support)
  | 'view_tickets'
  | 'update_ticket_status'
  | 'update_ticket_priority'
  | 'assign_tickets'
  | 'add_internal_notes'
  | 'escalate_tickets'
  | 'view_ticket_history'
  | 'view_all_tickets'
  // User & KYC Management (Phase 5)
  | 'view_users'
  | 'manage_kyc'
  // Accounting
  | 'approve_vouchers'
  | 'edit_order_transfer'
  // Operations
  | 'revenue_sharing'
  | 'nsdl_batch'
  | 'chart_of_stocks'
  | 'stock_interests'
  | 'sell_requests'
  | 'demat_approval'
  // Marketing
  | 'marketing_view'
  | 'marketing_export'
  | 'marketing_campaign_manage'
  | 'marketing_lead_assign'
  | 'marketing_dashboard_view'
  | 'marketing_reports_view';

/**
 * Admin interface matching backend admin object structure
 */
export interface Admin {
  id: string; // CUID
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: AdminPermission[]; // Array of valid permission strings
  isActive?: boolean; // Optional - for soft delete support
  lastLoginAt?: string; // Optional - ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Support Agent interface extending Admin with additional support-specific properties
 */
export interface SupportAgent extends Admin {
  availability?: 'available' | 'busy' | 'unavailable'; // Support agent availability status
  availabilityNote?: string; // Optional note about availability status
  activeTicketCount?: number; // Number of active tickets assigned to this agent
}

/**
 * Request payload for admin login
 */
export interface AdminLoginDto {
  email: string; // Email format
  password: string; // Min 8 characters
}

/**
 * Response from /auth/admin/login endpoint
 */
export interface AdminLoginResponse {
  success: boolean;
  requiresOtp?: boolean;
  message?: string;
  admin?: {
    id: string;
    email: string;
    fullName: string;
    role: AdminRole;
    permissions: AdminPermission[];
  };
  token?: string; // JWT token
}

/**
 * Decoded admin JWT token structure
 * Used for type-safe token decoding
 */
export interface AdminJWTPayload {
  adminId: string;
  email: string;
  fullName?: string;
  role: AdminRole;
  permissions: AdminPermission[];
  type: 'ADMIN'; // Distinguishes from user tokens
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

/**
 * Request payload for creating a new admin
 * Used by POST /auth/admin/create endpoint
 */
export interface CreateAdminDto {
  email: string;
  fullName: string;
  password: string;
  role?: AdminRole;
  permissions?: AdminPermission[];
}

/**
 * Request payload for creating a new Support Agent
 * Used by POST /auth/admins/support-agent endpoint
 */
export interface CreateSupportAgentDto extends CreateAdminDto {
  availability?: 'available' | 'busy' | 'unavailable';
  availabilityNote?: string;
}

/**
 * Request payload for updating admin permissions
 * Used by PATCH /auth/admin/:id endpoint
 */
export interface UpdateAdminPermissionsDto {
  permissions: AdminPermission[];
}

/**
 * Response from GET /auth/admins endpoint
 */
export interface AdminListResponse {
  success: boolean;
  admins: Admin[];
}
