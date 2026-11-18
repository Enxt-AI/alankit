/**
 * Admin Form Validation Schemas
 * 
 * Zod schemas for admin create and permission update forms
 */

import { z } from 'zod';
import type { AdminPermission } from '@/types/admin';

/**
 * Admin permissions array - comprehensive list of all valid permissions
 * Derived from AdminPermission type to ensure consistency
 * Single source of truth for permission validation
 */
export const ADMIN_PERMISSIONS_ARRAY = [
  // Legacy permissions (Milestone 1)
  'manage_stocks',
  'update_orders',
  'manage_content',
  // NOTE: 'manage_referrals' removed -- referral system deprecated
  'create_admins',
  'create_cms',
  'manage_faqs',
  // Admin permissions (Admin Stock Management)
  'admin_stocks',
  'ADMIN_BASKETS',
  // CMS permissions (Milestone 2)
  'cms_stocks',
  'cms_articles',
  'cms_news',
  'cms_faqs',
  'cms_static_pages',
  'cms_baskets',
  'cms_testimonials',
  'cms_demat_approval',
  // Support permissions (Milestone 2 - Agent-Facing Support)
  'view_tickets',
  'update_ticket_status',
  'update_ticket_priority',
  'assign_tickets',
  'add_internal_notes',
  'escalate_tickets',
  'view_ticket_history',
  'view_all_tickets',
  // User & KYC Management (Phase 5)
  'view_users',
  'manage_kyc',
  // Accounting & Order Details
  'approve_vouchers',
  'edit_order_transfer',
  // Operations
  'revenue_sharing',
  'nsdl_batch',
  'chart_of_stocks',
  'stock_interests',
  'sell_requests',
  'demat_approval',
  // Marketing
  'marketing_view',
  'marketing_export',
] as const satisfies readonly AdminPermission[];

/**
 * Schema for creating a new admin
 * Used in CreateAdminForm
 */
export const createAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
  role: z.enum(['ADMIN', 'SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_AGENT', 'ACCOUNTANT', 'OPERATIONS', 'MARKETING_MANAGER', 'SALES_EMPLOYEE']),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS_ARRAY)),
});

/**
 * Schema for updating admin permissions
 * Used in UpdateAdminPermissionsForm
 */
export const updateAdminPermissionsSchema = z.object({
  permissions: z.array(z.enum(ADMIN_PERMISSIONS_ARRAY)),
});

/**
 * Type inference for create form values
 */
export type CreateAdminFormValues = z.infer<typeof createAdminSchema>;

/**
 * Type inference for update form values
 */
export type UpdateAdminPermissionsFormValues = z.infer<typeof updateAdminPermissionsSchema>;
