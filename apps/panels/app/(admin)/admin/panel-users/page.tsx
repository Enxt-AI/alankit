'use client';

/**
 * Panel User Management Page
 * 
 * Super Admin only - manage panel user accounts (Support Agents, Content Managers,
 * Operations, Accountants, Marketing Managers).
 * Features: Create panel users, edit permissions, delete, search, pagination.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAdmins, useCreateAdmin, useUpdateAdminPermissions, useDeleteAdmin } from '@/hooks/use-admin-management';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { validatePassword, generateRandomPassword } from '@/lib/password-policy';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, EyeOff, Users } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import { useAuthStore } from '@/store/auth-store';
import type { Admin, AdminRole, AdminPermission, CreateAdminDto } from '@/types/admin';

// Panel user roles (not ADMIN or SUPER_ADMIN)
const PANEL_ROLES: { value: AdminRole; label: string }[] = [
  { value: 'SUPPORT_AGENT', label: 'Support Agent' },
  { value: 'CONTENT_MANAGER', label: 'Content Manager' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'MARKETING_MANAGER', label: 'Marketing Manager' },
  { value: 'SALES_EMPLOYEE', label: 'Sales Employee' },
];

// Permissions grouped by category
const PERMISSION_GROUPS: { category: string; permissions: { key: AdminPermission; label: string; description: string }[] }[] = [
  {
    category: 'CMS',
    permissions: [
      { key: 'cms_stocks', label: 'CMS Stocks', description: 'Manage stocks in CMS panel' },
      { key: 'cms_articles', label: 'CMS Articles', description: 'Manage articles in CMS panel' },
      { key: 'cms_news', label: 'CMS News', description: 'Manage news in CMS panel' },
      { key: 'cms_faqs', label: 'CMS FAQs', description: 'Manage FAQs in CMS panel' },
      { key: 'cms_static_pages', label: 'CMS Static Pages', description: 'Manage static pages in CMS panel' },
      { key: 'cms_baskets', label: 'CMS Baskets', description: 'Manage baskets in CMS panel' },
      { key: 'cms_testimonials', label: 'CMS Testimonials', description: 'Manage testimonials in CMS panel' },
      { key: 'cms_carousel', label: 'CMS Carousel Media', description: 'Manage carousel media (images/videos/GIFs) in CMS panel' },
    ],
  },
  {
    category: 'Operations',
    permissions: [
      { key: 'update_orders', label: 'Order Management', description: 'Approve, reject, and manage order statuses' },
      { key: 'manage_stocks', label: 'Stock Pricing', description: 'View and manage stock listings and pricing' },
      { key: 'demat_approval', label: 'Demat Approval', description: 'Review and approve/reject user Demat submissions' },
      { key: 'edit_order_transfer', label: 'Edit Order Transfer Referance No.', description: 'Allows editing share transfer referance number/date details on completed orders' },
      { key: 'revenue_sharing', label: 'Revenue Sharing', description: 'Configure revenue sharing percentages for RMs and Distributors' },
      { key: 'nsdl_batch', label: 'NSDL Batch', description: 'Generate and manage NSDL SPEED batch files for share transfers' },
      { key: 'chart_of_stocks', label: 'Chart of Stocks', description: 'View stock inventory chart and holdings overview' },
      { key: 'stock_interests', label: 'Stock Interests', description: 'View and manage user stock interest submissions' },
      { key: 'sell_requests', label: 'Sell Requests', description: 'View and manage user sell requests' },
    ],
  },
  {
    category: 'User & KYC Management',
    permissions: [
      { key: 'view_users', label: 'View Users', description: 'View user accounts and details' },
      { key: 'manage_kyc', label: 'Manage KYC', description: 'Verify and manage user KYC documents' },
    ],
  },
  {
    category: 'Admin Stocks & Baskets',
    permissions: [
      { key: 'admin_stocks', label: 'Admin Stocks', description: 'Admin-level stock management' },
      { key: 'ADMIN_BASKETS', label: 'Manage Baskets', description: 'Create and manage stock baskets' },
    ],
  },
  {
    category: 'Support',
    permissions: [
      { key: 'view_tickets', label: 'View Tickets', description: 'View support tickets' },
      { key: 'view_all_tickets', label: 'View All Tickets', description: 'View all tickets in the system' },
      { key: 'update_ticket_status', label: 'Update Ticket Status', description: 'Change ticket status' },
      { key: 'update_ticket_priority', label: 'Update Ticket Priority', description: 'Change ticket priority' },
      { key: 'assign_tickets', label: 'Assign Tickets', description: 'Assign tickets to agents' },
      { key: 'add_internal_notes', label: 'Add Internal Notes', description: 'Add internal comments' },
      { key: 'escalate_tickets', label: 'Escalate Tickets', description: 'Escalate tickets' },
      { key: 'view_ticket_history', label: 'View Ticket History', description: 'View ticket history' },
    ],
  },
  {
    category: 'Administration',
    permissions: [
      { key: 'create_admins', label: 'Create Admins', description: 'Create admin accounts' },
      { key: 'create_cms', label: 'Create CMS Users', description: 'Create Content Manager accounts' },
    ],
  },
  {
    category: 'Accounting',
    permissions: [
      { key: 'approve_vouchers', label: 'Approve Vouchers', description: 'Review and approve/remark pending vouchers' },
    ],
  },
  {
    category: 'Marketing',
    permissions: [
      { key: 'marketing_view', label: 'Viewer Permission', description: 'Allows users to view all data within the Marketing module.' },
      { key: 'marketing_export', label: 'Export Permission', description: 'Allows users to export data from the Marketing module wherever applicable.' },
      { key: 'marketing_campaign_manage', label: 'Manage Campaigns', description: 'Create, edit, and delete campaigns.' },
      { key: 'marketing_lead_assign', label: 'Assign Leads', description: 'Assign leads to specific users.' },
      { key: 'marketing_dashboard_view', label: 'View Dashboard', description: 'View the Marketing Dashboard tab.' },
      { key: 'marketing_reports_view', label: 'View Reports', description: 'View the Marketing Reports tab.' },
    ],
  },
];

/**
 * Map each panel role to the permission categories they can access.
 * In the edit dialog, only show relevant groups for the user's role.
 */
const ROLE_PERMISSION_GROUPS: Record<string, string[]> = {
  CONTENT_MANAGER: ['CMS'],
  SUPPORT_AGENT: ['Support'],
  OPERATIONS: ['Operations'],
  ACCOUNTANT: ['Accounting'],  // Accounting panel has permission gating for approvals
  MARKETING_MANAGER: ['Marketing'],  // Marketing panel permissions
  SALES_EMPLOYEE: ['Marketing'],
};

/** Get filtered permission groups for a given role */
function getPermissionGroupsForRole(role: AdminRole) {
  const allowedCategories = ROLE_PERMISSION_GROUPS[role];
  if (!allowedCategories) return PERMISSION_GROUPS; // unknown role: show all
  if (allowedCategories.length === 0) return []; // role has no permissions
  return PERMISSION_GROUPS.filter((g) => allowedCategories.includes(g.category));
}

function getRoleBadgeColor(role: AdminRole) {
  switch (role) {
    case 'SUPPORT_AGENT': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'CONTENT_MANAGER': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'OPERATIONS': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'ACCOUNTANT': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'MARKETING_MANAGER': return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'SALES_EMPLOYEE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function formatRole(role: AdminRole) {
  return role.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

export default function PanelUsersPage() {
  useAdminAuth();
  const { admin } = useAuthStore();
  const router = useRouter();

  const { data: allAdmins = [], isLoading, error } = useAdmins();
  const createMutation = useCreateAdmin();
  const updatePermissionsMutation = useUpdateAdminPermissions();
  const deleteMutation = useDeleteAdmin();

  // Filter to only show panel users (not ADMIN or SUPER_ADMIN)
  const panelUsers = allAdmins.filter(
    (a) => !['ADMIN', 'SUPER_ADMIN'].includes(a.role)
  );

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const filteredUsers = panelUsers.filter((user) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const qDigits = q.replace(/\D/g, '');
    const phoneDigits = ((user as any).phone || '').replace(/\D/g, '');
    return (
      (user.email || '').toLowerCase().includes(q) ||
      (user.fullName || '').toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q) ||
      formatRole(user.role).toLowerCase().includes(q) ||
      (qDigits.length >= 3 && phoneDigits.includes(qDigits))
    );
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [searchQuery]);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    fullName: '',
    password: '',
    role: 'SUPPORT_AGENT' as AdminRole,
    permissions: [] as AdminPermission[],
  });
  const [showPassword, setShowPassword] = useState(false);

  // Edit permissions dialog
  const [editingUser, setEditingUser] = useState<Admin | null>(null);
  const [editPermissions, setEditPermissions] = useState<AdminPermission[]>([]);

  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<Admin | null>(null);

  const handleCreate = async () => {
    if (!createForm.email.trim() || !createForm.fullName.trim() || !createForm.password) {
      notify.error('Please fill in all required fields');
      return;
    }
    const passValidation = validatePassword(createForm.password);
    if (!passValidation.isValid) {
      notify.error(passValidation.errorMessage || 'Password must be at least 8 characters and meet complexity rules');
      return;
    }
    try {
      const dto: CreateAdminDto = {
        email: createForm.email.trim().toLowerCase(),
        fullName: createForm.fullName.trim(),
        password: createForm.password,
        role: createForm.role,
        permissions: createForm.permissions,
      };
      await createMutation.mutateAsync(dto);
      setShowCreate(false);
      setCreateForm({ email: '', fullName: '', password: '', role: 'SUPPORT_AGENT', permissions: [] });
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingUser) return;
    try {
      await updatePermissionsMutation.mutateAsync({
        id: editingUser.id,
        permissions: editPermissions,
      });
      setEditingUser(null);
    } catch {
      // Error handled by mutation hook
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteMutation.mutateAsync(deletingUser.id);
      setDeletingUser(null);
    } catch {
      // Error handled by mutation hook
    }
  };

  const togglePermission = (
    perm: AdminPermission,
    list: AdminPermission[],
    setList: (perms: AdminPermission[]) => void
  ) => {
    if (list.includes(perm)) {
      let nextList = list.filter((p) => p !== perm);
      // If un-ticking Order Management, auto un-tick Edit Order Transfer since it depends on Order Management
      if (perm === 'update_orders') {
        nextList = nextList.filter((p) => p !== 'edit_order_transfer');
      }
      if (perm === 'demat_approval') {
        nextList = nextList.filter((p) => p !== 'cms_demat_approval');
      }
      setList(nextList);
    } else {
      let nextList = [...list, perm];
      // If ticking Edit Order Transfer Reference No., auto-tick Order Management
      if (perm === 'edit_order_transfer' && !nextList.includes('update_orders')) {
        nextList.push('update_orders');
      }
      if (perm === 'demat_approval' && !nextList.includes('cms_demat_approval')) {
        nextList.push('cms_demat_approval');
      }
      setList(nextList);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Panel User Management</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Manage panel users — Support Agents, Content Managers, Operations, Accountants, Marketing Managers.
          </p>
        </div>
        <Button 
          onClick={() => setShowCreate(true)} 
          className="gap-2 border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4"
        >
          <Plus className="h-4 w-4" />
          Create Panel User
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]/60" />
          <Input
            name="user-search"
            autoComplete="off"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
          />
        </div>
        <span className="text-sm font-semibold text-[#64748B]">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Loading */}
      {isLoading && <AdminTableSkeleton rows={5} columns={6} />}

      {/* Error */}
      {error && (
        <div className="flex h-60 items-center justify-center border border-neutral-200/40 rounded-[20px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="text-center">
            <h2 className="text-lg font-bold text-[#0F172A]">Error Loading Users</h2>
            <p className="text-sm text-red-500 mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredUsers.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center p-8 border border-neutral-200/40 rounded-[20px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-4">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A]">No Panel Users Found</h3>
          <p className="text-sm text-[#64748B] mt-1.5 max-w-sm">
            {searchQuery ? 'No users match your search.' : 'Create your first panel user to get started.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && filteredUsers.length > 0 && (
        <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
          <Table>
            <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
              <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 pl-6">Name</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Email</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Role</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Permissions</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Created</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 text-right pr-6 w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedUsers.map((user) => (
                <TableRow 
                  key={user.id} 
                  className="border-b border-neutral-200/30 hover:bg-[#F8FAFC] transition-colors duration-300"
                >
                  <TableCell className="font-bold text-[#0F172A] text-sm py-4 pl-6">{user.fullName}</TableCell>
                  <TableCell className="text-sm font-semibold text-[#64748B] py-4">{user.email}</TableCell>
                  <TableCell className="py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getRoleBadgeColor(user.role)}`}>
                      {formatRole(user.role)}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-sm font-semibold text-[#64748B]">
                      {user.permissions?.length || 0} permission{(user.permissions?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-[#64748B] py-4">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right py-4 pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#ECFDF5]/50 hover:text-[#16A34A] rounded-lg">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl border border-neutral-200/40 bg-white">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingUser(user);
                            const userPerms = [...(user.permissions || [])];
                            if (userPerms.includes('cms_demat_approval') && !userPerms.includes('demat_approval')) {
                              userPerms.push('demat_approval');
                            }
                            setEditPermissions(userPerms);
                          }}
                          className="hover:bg-[#FAFBFC] focus:bg-[#FAFBFC] cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4 text-[#16A34A]" />
                          Edit Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingUser(user)}
                          className="text-destructive focus:text-destructive hover:bg-red-50 focus:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm font-semibold text-[#64748B]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1} 
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-neutral-200/60 text-[#0F172A] hover:bg-[#FAFBFC] font-semibold h-10 px-4 transition-all duration-300 ease-in-out"
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === totalPages} 
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-neutral-200/60 text-[#0F172A] hover:bg-[#FAFBFC] font-semibold h-10 px-4 transition-all duration-300 ease-in-out"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ======== Create Panel User Dialog ======== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Panel User</DialogTitle>
            <DialogDescription>
              Create a new panel user with a specific role and permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[#0F172A]">Full Name</label>
              <Input
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                placeholder="John Doe"
                className="h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[#0F172A]">Email</label>
              <Input
                type="email"
                name="new-user-email"
                autoComplete="off"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value.toLowerCase() })}
                placeholder="john@example.com"
                className="h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#0F172A]">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    const newPass = generateRandomPassword(8);
                    setCreateForm({ ...createForm, password: newPass });
                    setShowPassword(true);
                  }}
                  className="text-xs font-medium text-[#16A34A] hover:underline cursor-pointer"
                >
                  Auto-Generate
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="new-user-password"
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Min 8: upper, lower, number, special"
                  className="h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 pr-10 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={createForm.password} />
              <p className="text-xs text-[#64748B]">Min 8 chars with uppercase, lowercase, number & special character</p>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[#0F172A]">Role</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as AdminRole })}
                className="flex h-10 w-full rounded-[14px] border border-neutral-200/60 bg-white px-3 py-1.5 text-sm text-[#0F172A] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] cursor-pointer"
              >
                {PANEL_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#0F172A]">Permissions</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold rounded-lg border-neutral-200/60"
                    onClick={() => {
                      const allForRole = getPermissionGroupsForRole(createForm.role).flatMap(g => g.permissions.map(p => p.key));
                      if (allForRole.includes('demat_approval') && !allForRole.includes('cms_demat_approval')) {
                        allForRole.push('cms_demat_approval');
                      }
                      setCreateForm({ ...createForm, permissions: allForRole });
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold rounded-lg border-neutral-200/60"
                    onClick={() => setCreateForm({ ...createForm, permissions: [] })}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              {getPermissionGroupsForRole(createForm.role).map((group) => (
                <div key={group.category} className="space-y-2 border border-neutral-100 rounded-xl p-3 bg-[#FAFBFC]">
                  <p className="text-xs font-extrabold text-[#64748B] uppercase tracking-wider">{group.category}</p>
                  <div className="space-y-1.5 pl-1">
                    {group.permissions.map((perm) => (
                      <label key={perm.key} className="flex items-start gap-2.5 cursor-pointer">
                        <Checkbox
                          checked={createForm.permissions.includes(perm.key)}
                          onCheckedChange={() => togglePermission(perm.key, createForm.permissions, (p) => setCreateForm({ ...createForm, permissions: p }))}
                          className="mt-0.5 rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A]"
                        />
                        <div>
                          <span className="text-sm font-bold text-[#0F172A]">{perm.label}</span>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" className="rounded-lg h-10 px-4 border-neutral-200/60 font-semibold" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !createForm.email || !createForm.fullName || !createForm.password}
              className="border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4"
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Edit Permissions Dialog ======== */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
          <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Permissions</DialogTitle>
              <DialogDescription>
                Update permissions for <strong>{editingUser.fullName}</strong> ({formatRole(editingUser.role)})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {getPermissionGroupsForRole(editingUser.role).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-[#FAFBFC] rounded-xl border border-dashed border-neutral-200/60">
                  <p className="text-sm font-bold text-[#0F172A]">No permissions required</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    The {formatRole(editingUser.role)} role has full access to its panel without granular permissions.
                  </p>
                </div>
              ) : (
              <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#64748B]">
                  {editPermissions.length} permission{editPermissions.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold rounded-lg border-neutral-200/60"
                    onClick={() => {
                      const allForRole = getPermissionGroupsForRole(editingUser.role).flatMap(g => g.permissions.map(p => p.key));
                      if (allForRole.includes('demat_approval') && !allForRole.includes('cms_demat_approval')) {
                        allForRole.push('cms_demat_approval');
                      }
                      setEditPermissions(allForRole);
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold rounded-lg border-neutral-200/60"
                    onClick={() => setEditPermissions([])}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {getPermissionGroupsForRole(editingUser.role).map((group) => (
                <div key={group.category} className="space-y-2 border border-neutral-100 rounded-xl p-3 bg-[#FAFBFC]">
                  <p className="text-xs font-extrabold text-[#64748B] uppercase tracking-wider">{group.category}</p>
                  <div className="space-y-1.5 pl-1">
                    {group.permissions.map((perm) => (
                      <label key={perm.key} className="flex items-start gap-2.5 cursor-pointer">
                        <Checkbox
                          checked={editPermissions.includes(perm.key)}
                          onCheckedChange={() => togglePermission(perm.key, editPermissions, setEditPermissions)}
                          className="mt-0.5 rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A]"
                        />
                        <div>
                          <span className="text-sm font-bold text-[#0F172A]">{perm.label}</span>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              </>
              )}
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button variant="outline" className="rounded-lg h-10 px-4 border-neutral-200/60 font-semibold" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button
                onClick={handleUpdatePermissions}
                disabled={updatePermissionsMutation.isPending}
                className="border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4"
              >
                {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ======== Delete Confirmation Dialog ======== */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
        <AlertDialogContent className="rounded-[20px] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#0F172A]">Delete Panel User</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#64748B]">
              Are you sure you want to delete <strong>{deletingUser?.fullName}</strong> ({deletingUser?.email})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg h-10 px-4 border-neutral-200/60 font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg h-10 px-4 font-semibold"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
