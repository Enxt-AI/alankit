"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  X,
  AlertCircle,
  Search,
  ShieldCheck,
  Ticket,
  UserCheck,
  Layers,
  Plus,
} from "lucide-react";
import { z } from "zod";
import {
  useRMs,
  useCreateRM,
  useUpdateRMEmployeeId,
  RM,
} from "@/hooks/use-rms";
import { usePortalProfile } from "@/hooks/use-profile";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const rmSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  employeeId: z
    .string()
    .trim()
    .min(1, "Employee ID is required")
    .max(100, "Employee ID must be at most 100 characters long"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

const employeeIdSchema = z
  .string()
  .trim()
  .min(1, "Employee ID is required")
  .max(100, "Employee ID must be at most 100 characters long");

export default function RmsManagementPage() {
  const [userType, setUserType] = useState<string>("distributor");

  useEffect(() => {
    setUserType(localStorage.getItem("userType") || "distributor");
  }, []);

  const { data: rms = [], isLoading } = useRMs(userType);
  const { data: profile } = usePortalProfile("distributor");
  const createRMMutation = useCreateRM(userType);
  const updateEmployeeIdMutation = useUpdateRMEmployeeId(userType);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Create Form State
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    employeeId: "",
    email: "",
    password: "",
  });
  const [formError, setFormError] = useState("");

  // Edit Employee ID State (for older RMs without an employee ID or updating existing)
  const [editingRm, setEditingRm] = useState<RM | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editError, setEditError] = useState("");

  const handleOpenEditEmployeeId = (rm: RM) => {
    if (rm.employeeId) return;
    setEditingRm(rm);
    setEditEmployeeId("");
    setEditError("");
  };

  const handleUpdateEmployeeId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRm || editingRm.employeeId) return;
    setEditError("");

    const validation = employeeIdSchema.safeParse(editEmployeeId);
    if (!validation.success) {
      setEditError(
        validation.error.issues[0]?.message || "Employee ID is required",
      );
      return;
    }

    try {
      await updateEmployeeIdMutation.mutateAsync({
        id: editingRm.id,
        employeeId: validation.data,
      });
      setEditingRm(null);
      setEditEmployeeId("");
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update Employee ID",
      );
    }
  };

  const handleCreateRM = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const validation = rmSchema.safeParse(formData);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || "Validation failed");
      return;
    }

    try {
      await createRMMutation.mutateAsync({
        ...formData,
        ...validation.data,
        company: profile?.name || " Distributor Partner",
      });
      setIsCreating(false);
      setFormData({ name: "", employeeId: "", email: "", password: "" });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to create Relationship Manager",
      );
    }
  };

  const filteredRms = useMemo(() => {
    return rms.filter((rm) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        rm.name.toLowerCase().includes(q) ||
        (rm.employeeId || "").toLowerCase().includes(q) ||
        rm.email.toLowerCase().includes(q) ||
        (rm.company || "").toLowerCase().includes(q)
      );
    });
  }, [rms, searchQuery]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredRms.length / itemsPerPage) || 1;
  const paginatedRms = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRms.slice(start, start + itemsPerPage);
  }, [filteredRms, currentPage, itemsPerPage]);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages,
        );
      }
    }
    return pages;
  };

  const totalCount = rms.length;
  const activeCount = rms.filter((r) => r.status === "ACTIVE").length;
  const totalCouponsGenerated = rms.reduce(
    (acc, r) => acc + (r._count?.couponsGenerated || 0),
    0,
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Relationship Managers
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
              Distributor Network
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 whitespace-nowrap">
            Provision and manage RM accounts assigned to your distributor
            profile.
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-sm font-medium text-sm transition-all whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Relationship Manager</span>
          </button>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total RMs */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Total Team Members
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">
              {totalCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
              Registered Relationship Managers
            </p>
          </div>
        </div>

        {/* Card 2: Active Accounts */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Active Accounts
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-emerald-600 whitespace-nowrap">
              {activeCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
              Enabled for client referrals
            </p>
          </div>
        </div>

        {/* Card 3: Total Referral Codes */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Total Referral Codes
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">
              {totalCouponsGenerated}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
              Discount codes generated by team
            </p>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, employee ID, email, or branch / network..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent focus:outline-none text-sm text-slate-800 placeholder-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:inline-block border-l border-slate-200 pl-3">
          {filteredRms.length} {filteredRms.length === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">
                  Add Relationship Manager
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                  Create access credentials for a new team member
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {formError && (
                <div className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateRM} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Full Name
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:ring-2 ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="e.g. Priya Patel"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="employeeId"
                    className="text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                  >
                    Employee ID (required)
                  </label>
                  <input
                    id="employeeId"
                    name="employeeId"
                    required
                    type="text"
                    maxLength={100}
                    value={formData.employeeId}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeId: e.target.value })
                    }
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:ring-2 ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Enter employee ID"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Email Address
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:ring-2 ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="priya.patel@distributor.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Temporary Password
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm font-mono text-slate-900 outline-none focus:ring-2 ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={createRMMutation.isPending}
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2 rounded-lg shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {createRMMutation.isPending
                      ? "Creating Account..."
                      : "Save Relationship Manager"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Set / Update Employee ID Modal for Existing RMs */}
      {editingRm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">
                  Add Employee ID
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[300px]">
                  {editingRm.name} ({editingRm.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRm(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {editError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateEmployeeId} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="editEmployeeId"
                    className="text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                  >
                    Employee ID (required)
                  </label>
                  <input
                    id="editEmployeeId"
                    name="employeeId"
                    required
                    autoFocus
                    type="text"
                    maxLength={100}
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:ring-2 ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Enter employee ID"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingRm(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={updateEmployeeIdMutation.isPending}
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2 rounded-lg shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {updateEmployeeIdMutation.isPending
                      ? "Saving..."
                      : "Save Employee ID"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RM Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
              <p className="text-sm font-medium text-slate-500">
                Loading Relationship Managers...
              </p>
            </div>
          </div>
        ) : rms.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4 border border-slate-200">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              No Relationship Managers registered
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              You haven't provisioned any RM accounts yet. Click "Add
              Relationship Manager" above to create an account.
            </p>
          </div>
        ) : filteredRms.length === 0 ? (
          <div className="text-center py-14 px-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No matching Relationship Managers
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
              No team members match your search criteria. Try modifying your
              search keywords.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
            >
              Clear search filter
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider uppercase">
                  <tr>
                    <th className="py-3.5 px-6 whitespace-nowrap">
                      Relationship Manager
                    </th>
                    <th className="py-3.5 px-6 whitespace-nowrap">
                      Employee ID
                    </th>
                    <th className="py-3.5 px-6 whitespace-nowrap">
                      Email Address
                    </th>
                    <th className="py-3.5 px-6 whitespace-nowrap">
                      Branch / Network Name
                    </th>
                    <th className="py-3.5 px-6 whitespace-nowrap text-center">
                      Account Status
                    </th>
                    <th className="py-3.5 px-6 whitespace-nowrap text-center">
                      Referral Codes Generated
                    </th>
                    <th className="py-3.5 px-6 whitespace-nowrap text-center">
                      Created Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedRms.map((rm) => (
                    <tr
                      key={rm.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3.5 px-6 whitespace-nowrap font-semibold text-slate-900">
                        {rm.name}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 text-xs">
                        {rm.employeeId ? (
                          <span className="font-mono font-medium text-slate-800">
                            {rm.employeeId}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEditEmployeeId(rm)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Employee ID</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 text-xs">
                        {rm.email}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 text-xs">
                        {rm.company || profile?.name || " Distributor Partner"}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rm.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-rose-50 text-rose-700 border border-rose-200/60"
                          }`}
                        >
                          {rm.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap text-center font-mono font-medium text-slate-800">
                        <span className="inline-flex items-center justify-center bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          {rm._count?.couponsGenerated ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap text-center text-xs text-slate-500">
                        {new Date(rm.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Shadcn UI Pagination Controls */}
            {filteredRms.length > 0 && (
              <div className="p-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredRms.length === 0
                      ? 0
                      : (currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-700">
                    {Math.min(currentPage * itemsPerPage, filteredRms.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredRms.length}
                  </span>{" "}
                  team members
                </p>
                <Pagination className="justify-end w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage((p) => p - 1);
                        }}
                        className={
                          currentPage <= 1
                            ? "pointer-events-none opacity-40 cursor-not-allowed text-xs h-8"
                            : "cursor-pointer text-xs h-8"
                        }
                      />
                    </PaginationItem>

                    {getPageNumbers().map((item, idx) => (
                      <PaginationItem key={idx}>
                        {item === "..." ? (
                          <PaginationEllipsis className="h-8 w-8 text-xs" />
                        ) : (
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(Number(item));
                            }}
                            isActive={currentPage === item}
                            className={`cursor-pointer text-xs h-8 w-8 ${currentPage === item ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold" : ""}`}
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages)
                            setCurrentPage((p) => p + 1);
                        }}
                        className={
                          currentPage >= totalPages
                            ? "pointer-events-none opacity-40 cursor-not-allowed text-xs h-8"
                            : "cursor-pointer text-xs h-8"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
