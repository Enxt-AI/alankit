/**
 * Admin permissions constants - single source of truth for all admin permissions
 * Must be kept in sync with frontend AdminPermission type in apps/web/types/admin.ts
 */
// NOTE: 'manage_referrals' was removed as part of RM and referral system deprecation.
export const ALL_PERMISSIONS = [
  'manage_stocks', 'update_orders', 'manage_content',
  'create_admins', 'create_cms', 'manage_faqs',
  'cms_stocks', 'cms_articles', 'cms_news', 'cms_faqs', 'cms_static_pages', 'cms_baskets', 'cms_testimonials', 'cms_carousel', 'cms_demat_approval',
  'ADMIN_BASKETS',
  'view_tickets', 'update_ticket_status', 'update_ticket_priority', 'assign_tickets', 'add_internal_notes',
  'escalate_tickets', 'view_ticket_history', 'view_all_tickets',
  'view_users', 'manage_kyc',
  'approve_vouchers',
  'edit_order_transfer',
  'revenue_sharing',
  'nsdl_batch',
  'chart_of_stocks',
  'stock_interests',
  'sell_requests',
  'demat_approval',
  'marketing_view',
  'marketing_export',
  'marketing_dashboard_view',
  'marketing_reports_view',
  'marketing_campaign_manage',
  'marketing_lead_assign'
];

export type AdminPermission = typeof ALL_PERMISSIONS[number];