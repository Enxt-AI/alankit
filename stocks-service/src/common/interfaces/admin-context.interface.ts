/**
 * Interface defining the structure of admin context data
 * captured from JWT tokens for audit logging purposes
 */
export interface AdminContext {
  /** Unique identifier of the admin user */
  adminId: string;

  /** Email address of the admin user */
  email: string;

  /** Role of the admin user (e.g., 'ADMIN', 'SUPER_ADMIN') */
  role: string;

  /** Array of permissions granted to the admin user */
  permissions: string[];
}
