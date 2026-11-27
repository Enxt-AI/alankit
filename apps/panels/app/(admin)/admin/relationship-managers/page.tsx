"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import {
  useRMs,
  useBranches,
  useDistributors,
  NetworkUser,
} from "@/hooks/use-network-management";
import { notify } from "@/components/ui/floating-notification";
import { validatePassword } from "@/lib/password-policy";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Users,
  Search,
  Copy,
  CheckCircle2,
  Calendar,
  Ticket,
  IndianRupee,
  BarChart3,
  Loader2,
  ArrowUpDown,
  Award,
  Sparkles,
  Filter,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { generateRandomPassword } from "@/lib/password-policy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Coupon {
  id: string;
  code: string;
  rmId: string;
  minQuantity: number;
  maxQuantity: number;
  discountAmount: number;
  discountType?: string;
  discountPercentage?: number;
  isUsed: boolean;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  stock: { name: string; price: number };
  assignedUser?: { fullName: string; email: string } | null;
  usedByUser?: {
    fullName: string;
    email: string;
    phone?: string | null;
  } | null;
  order?: { quantity: number; totalAmount: number } | null;
}

const getRmId = (c: any): string | null =>
  c?.rmId ||
  c?.internalRmId ||
  c?.distributorRmId ||
  c?.relationshipManager?.id ||
  null;

export default function RelationshipManagersPage() {
  const router = useRouter();
  const { admin: currentAdmin } = useAdminAuth();

  // Guard
  useEffect(() => {
    if (currentAdmin) {
      if (currentAdmin.role !== "SUPER_ADMIN") {
        router.push("/admin/dashboard");
      }
    }
  }, [currentAdmin, router]);

  const { data: rms, isLoading, createRM, deleteRM } = useRMs();
  const { data: branches } = useBranches();
  const { data: distributors } = useDistributors();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rmToDelete, setRmToDelete] = useState<NetworkUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    type: "INTERNAL_RM" as "INTERNAL_RM" | "DISTRIBUTOR_RM",
    parentId: "",
  });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    parentId?: string;
    global?: string;
  }>({});

  const handleOpenCreateModal = () => {
    const randomPassword = generateRandomPassword(12);
    setFormData({
      name: "",
      email: "",
      password: randomPassword,
      type: "INTERNAL_RM",
      parentId: branches.length > 0 ? branches[0]?.id || "" : "",
    });
    setFormErrors({});
    setShowPassword(true);
    setIsModalOpen(true);
  };

  // Sales Growth Analytics States
  const [allSales, setAllSales] = useState<Coupon[]>([]);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [chartMetric, setChartMetric] = useState<"revenue" | "conversions">(
    "revenue",
  );
  const [chartTimeframe, setChartTimeframe] = useState<
    "daily" | "monthly" | "yearly" | "all"
  >("monthly");
  const [selectedChartRMs, setSelectedChartRMs] = useState<string[]>([]);

  useEffect(() => {
    const fetchAllSales = async () => {
      setIsAnalyticsLoading(true);
      try {
        const response = await fetch("/api/stocks/coupons?rmId=all", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const couponsArray = Array.isArray(data) ? data : data.coupons || [];
          const rmIds = new Set(rms.map((r) => r.id));
          // Only include completed referred sales belonging to active RMs
          const usedCoupons = couponsArray.filter((c: any) => {
            const rmId = getRmId(c);
            return c.isUsed && rmId && rmIds.has(rmId);
          });
          setAllSales(usedCoupons);
        }
      } catch (err) {
        console.error("Error fetching all RM sales:", err);
      } finally {
        setIsAnalyticsLoading(false);
      }
    };

    if (currentAdmin && currentAdmin.role === "SUPER_ADMIN") {
      if (rms.length > 0) {
        fetchAllSales();
      } else {
        setAllSales([]);
      }
    }
  }, [currentAdmin, rms]);

  // Process all sales data for Recharts chart representation
  const getChartTimelineData = () => {
    if (allSales.length === 0) return { chartData: [], rmNames: [] };

    // Create a map of RM ID to Name for easy lookup
    const rmNameMap: Record<string, string> = {};
    rms.forEach((rm) => {
      rmNameMap[rm.id] = rm.name;
    });

    // Parse all sales and sort chronologically
    const parsedSales = allSales
      .map((sale) => {
        const dateStr = sale.usedAt || sale.createdAt;
        const rmId = getRmId(sale);
        const rmName = rmId ? rmNameMap[rmId] : null;
        if (!rmName) return null;
        return {
          date: new Date(dateStr),
          rmName,
          revenue: sale.order?.totalAmount || 0,
        };
      })
      .filter(
        (s): s is { date: Date; rmName: string; revenue: number } => s !== null,
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (parsedSales.length === 0) return { chartData: [], rmNames: [] };

    // Group sales by selected period granularity (day, month, or year)
    const salesByPeriod: Record<string, Record<string, number>> = {};
    const rmNamesSet = new Set<string>();

    parsedSales.forEach((sale) => {
      const yyyy = sale.date.getFullYear();
      const mm = String(sale.date.getMonth() + 1).padStart(2, "0");
      const dd = String(sale.date.getDate()).padStart(2, "0");

      let periodKey = "";
      if (chartTimeframe === "daily") {
        periodKey = `${yyyy}-${mm}-${dd}`;
      } else if (chartTimeframe === "yearly") {
        periodKey = `${yyyy}`;
      } else {
        // 'monthly' or 'all'
        periodKey = `${yyyy}-${mm}`;
      }

      if (!salesByPeriod[periodKey]) {
        salesByPeriod[periodKey] = {};
      }

      const periodGroup = salesByPeriod[periodKey];
      if (periodGroup) {
        const valueToAdd = chartMetric === "revenue" ? sale.revenue : 1;
        periodGroup[sale.rmName] = (periodGroup[sale.rmName] || 0) + valueToAdd;
      }
      rmNamesSet.add(sale.rmName);
    });

    const rmNamesList = Array.from(rmNamesSet);

    // Initialize tracking of selected RMs for chart toggle
    // If selectedChartRMs is empty, default to selecting all RMs
    const activeRMs =
      selectedChartRMs.length > 0 ? selectedChartRMs : rmNamesList;

    // Generate continuous list of periods from start to today
    const chartData: any[] = [];
    const sortedPeriods = Object.keys(salesByPeriod).sort();

    const firstPeriod = sortedPeriods[0];
    if (!firstPeriod) return { chartData: [], rmNames: rmNamesList };

    let startDate: Date;
    if (chartTimeframe === "daily") {
      const parts = firstPeriod.split("-");
      startDate = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2] || 1),
      );
    } else if (chartTimeframe === "monthly") {
      const parts = firstPeriod.split("-");
      startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    } else {
      startDate = new Date(Number(firstPeriod), 0, 1);
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    const lastSale = parsedSales[parsedSales.length - 1];
    const maxDate = lastSale ? lastSale.date : endDate;
    const finalEndDate = new Date(maxDate > endDate ? maxDate : endDate);
    finalEndDate.setHours(23, 59, 59, 999);

    // Running cumulative totals for each RM
    const cumulativeTotals: Record<string, number> = {};
    rmNamesList.forEach((name) => {
      cumulativeTotals[name] = 0;
    });
    let cumulativeTotalAll = 0;

    const current = new Date(startDate);
    while (current <= finalEndDate) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");

      let periodKey = "";
      let formattedDate = "";

      if (chartTimeframe === "daily") {
        periodKey = `${yyyy}-${mm}-${dd}`;
        formattedDate = current.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });
      } else if (chartTimeframe === "monthly") {
        periodKey = `${yyyy}-${mm}`;
        formattedDate = current.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        });
      } else {
        periodKey = `${yyyy}`;
        formattedDate = current.toLocaleDateString("en-IN", {
          year: "numeric",
        });
      }

      const periodValues = salesByPeriod[periodKey] || {};

      // Update cumulative running totals
      let periodTotalAll = 0;
      rmNamesList.forEach((name) => {
        const val = periodValues[name] || 0;
        cumulativeTotals[name] = (cumulativeTotals[name] || 0) + val;
        periodTotalAll += val;
      });
      cumulativeTotalAll += periodTotalAll;

      const dataPoint: any = {
        date: periodKey,
        formattedDate: formattedDate,
        "All RMs Combined": cumulativeTotalAll,
      };

      rmNamesList.forEach((name) => {
        dataPoint[name] = cumulativeTotals[name];
      });

      chartData.push(dataPoint);

      // Increment safely based on timeframe
      if (chartTimeframe === "daily") {
        current.setDate(current.getDate() + 1);
      } else if (chartTimeframe === "yearly") {
        current.setDate(1);
        current.setMonth(0);
        current.setFullYear(current.getFullYear() + 1);
      } else {
        current.setDate(1);
        current.setMonth(current.getMonth() + 1);
      }
    }

    return { chartData, rmNames: rmNamesList, activeRMs };
  };

  const { chartData, rmNames: chartRmNames } = getChartTimelineData();

  // Premium colors
  const RM_COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Emerald / Green (Primary )
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#06B6D4", // Cyan
  ];

  const getRmColor = (index: number) => {
    return RM_COLORS[index % RM_COLORS.length];
  };

  const handleToggleChartRm = (name: string) => {
    const currentList =
      selectedChartRMs.length > 0 ? selectedChartRMs : chartRmNames;
    if (currentList.includes(name)) {
      const newList = currentList.filter((n) => n !== name);
      setSelectedChartRMs(newList);
    } else {
      setSelectedChartRMs([...currentList, name]);
    }
  };

  // Main RM Table Search, Filter, Sort States
  const [rmSearchQuery, setRmSearchQuery] = useState("");
  const [rmStatusFilter, setRmStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [sortConfig, setSortConfig] = useState<{
    key: "name" | "conversionsCount" | "totalRevenue" | "createdAt";
    direction: "asc" | "desc";
  }>({ key: "totalRevenue", direction: "desc" });

  // Dynamically calculate RM performance stats from allSales
  const rmSalesStats = rms.map((rm) => {
    const rmCoupons = allSales.filter((c) => getRmId(c) === rm.id);
    const conversionsCount = rmCoupons.length;
    const totalRevenue = rmCoupons.reduce(
      (sum, c) => sum + (c.order?.totalAmount || 0),
      0,
    );
    return {
      ...rm,
      conversionsCount,
      totalRevenue,
    };
  });

  // Filter RMs list based on search query and status dropdown
  const filteredRMs = rmSalesStats.filter((rm) => {
    const nameMatch = rm.name
      .toLowerCase()
      .includes(rmSearchQuery.toLowerCase());
    const emailMatch = rm.email
      .toLowerCase()
      .includes(rmSearchQuery.toLowerCase());
    const statusMatch =
      rmStatusFilter === "ALL" || rm.status === rmStatusFilter;
    return (nameMatch || emailMatch) && statusMatch;
  });

  // Sort filtered RMs list
  const sortedRMs = [...filteredRMs].sort((a, b) => {
    const { key, direction } = sortConfig;
    let comparison = 0;

    if (key === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (key === "createdAt") {
      comparison =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      comparison = (a[key] as number) - (b[key] as number);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  const requestSort = (
    key: "name" | "conversionsCount" | "totalRevenue" | "createdAt",
  ) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Helper to filter sales by active timeframe for Top Performers
  const getSalesInTimeframe = (
    sales: Coupon[],
    timeframe: "daily" | "monthly" | "yearly" | "all",
  ) => {
    const now = new Date();
    return sales.filter((s) => {
      const d = new Date(s.createdAt);
      if (isNaN(d.getTime())) return false;
      if (timeframe === "daily") {
        return d.toDateString() === now.toDateString();
      }
      if (timeframe === "monthly") {
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }
      if (timeframe === "yearly") {
        return d.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  };

  const timeframeSales = getSalesInTimeframe(allSales, chartTimeframe);

  // Top performers calculated with respect to active timeframe and metric
  const topRmStats = rms
    .map((rm) => {
      const rmCoupons = timeframeSales.filter((c) => getRmId(c) === rm.id);
      const conversionsCount = rmCoupons.length;
      const totalRevenue = rmCoupons.reduce(
        (sum, c) => sum + (c.order?.totalAmount || 0),
        0,
      );
      return {
        ...rm,
        conversionsCount,
        totalRevenue,
      };
    })
    .filter((rm) =>
      chartMetric === "revenue" ? rm.totalRevenue > 0 : rm.conversionsCount > 0,
    );

  const topFiveRMs = [...topRmStats]
    .sort((a, b) => {
      if (chartMetric === "revenue") {
        return b.totalRevenue - a.totalRevenue;
      }
      return b.conversionsCount - a.conversionsCount;
    })
    .slice(0, 5);

  const maxRmPerformerValue =
    Math.max(
      ...topFiveRMs.map((d) =>
        chartMetric === "revenue" ? d.totalRevenue : d.conversionsCount,
      ),
      0,
    ) || 1;

  const maxRmRevenue =
    Math.max(...rmSalesStats.map((rm) => rm.totalRevenue), 0) || 1;

  const renderSortHeader = (
    label: string,
    key: "name" | "conversionsCount" | "totalRevenue" | "createdAt",
  ) => {
    const isSorted = sortConfig.key === key;
    return (
      <TableHead
        onClick={() => requestSort(key)}
        className="cursor-pointer hover:text-foreground select-none transition-colors"
      >
        <div className="flex items-center gap-1 font-semibold">
          {label}
          <ArrowUpDown
            className={`h-3 w-3 transition-transform ${isSorted ? "opacity-100 text-primary" : "opacity-40 hover:opacity-100"}`}
          />
        </div>
      </TableHead>
    );
  };

  const validateForm = () => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      parentId?: string;
    } = {};
    if (!formData.name.trim()) {
      errors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s]+$/.test(formData.name.trim())) {
      errors.name = "Name can only contain letters and spaces";
    }
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (!formData.password) {
      errors.password = "Password is required";
    } else {
      const passValidation = validatePassword(formData.password);
      if (!passValidation.isValid) {
        errors.password =
          passValidation.errorMessage ||
          "Password must be at least 8 characters and meet complexity rules";
      }
    }
    if (!formData.parentId) {
      errors.parentId = "Parent assignment is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    const result = await createRM(formData);
    if (result?.success) {
      setIsModalOpen(false);
      setFormData({
        name: "",
        email: "",
        password: "",
        type: "INTERNAL_RM",
        parentId: "",
      });
      setFormErrors({});
    } else {
      setFormErrors({
        ...formErrors,
        name: result?.message || "Failed to create RM",
      });
    }
    setIsSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!rmToDelete) return;
    setIsDeleting(true);
    await deleteRM(rmToDelete.id);
    setIsDeleting(false);
    setRmToDelete(null);
  };

  if (!currentAdmin || currentAdmin.role !== "SUPER_ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2 pb-12">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2 tracking-tight text-[#0F172A]">
            <Sparkles className="h-6 w-6 text-[#16A34A]" />
            Relationship Managers
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-50 text-[#64748B] border border-neutral-200/40 ml-1">
              {rms.length} active
            </span>
          </h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Monitor and manage relationship managers (RMs). They refer unlisted
            stock sales to clients.
          </p>
        </div>
        <Button
          onClick={handleOpenCreateModal}
          size="sm"
          className="h-10 px-4 self-start sm:self-auto shrink-0 border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Create RM
        </Button>
      </div>

      {/* KPI Cards Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="group flex items-center justify-between py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          style={{ boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}
        >
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Total Active RMs
            </p>
            <h3 className="text-2xl font-bold text-[#0F172A] tracking-tight leading-none mt-1.5">
              {rms.filter((r) => r.status === "ACTIVE").length}{" "}
              <span className="text-sm font-normal text-[#64748B]">
                / {rms.length} total
              </span>
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 transition-colors duration-300 ease-in-out group-hover:bg-[#DCFCE7]">
            <Users className="h-4.5 w-4.5" />
          </div>
        </div>

        <div
          className="group flex items-center justify-between py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          style={{ boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}
        >
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Overall Conversions
            </p>
            <h3 className="text-2xl font-bold text-[#0F172A] tracking-tight leading-none mt-1.5">
              {allSales.length}{" "}
              <span className="text-xs text-[#16A34A] font-bold bg-[#DCFCE7] px-2 py-0.5 rounded-lg border border-[#16A34A]/20 ml-1.5">
                sales
              </span>
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 transition-colors duration-300 ease-in-out group-hover:bg-[#DCFCE7]">
            <Ticket className="h-4.5 w-4.5" />
          </div>
        </div>

        <div
          className="group flex items-center justify-between py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          style={{ boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}
        >
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Total Revenue Driven
            </p>
            <h3 className="text-2xl font-bold text-[#16A34A] tracking-tight leading-none mt-1.5">
              ₹
              {allSales
                .reduce((sum, c) => sum + (c.order?.totalAmount || 0), 0)
                .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 transition-colors duration-300 ease-in-out group-hover:bg-[#DCFCE7]">
            <IndianRupee className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      {!isAnalyticsLoading && (
        <div className="space-y-4">
          {/* Global Analytics Control Bar */}
          <div className="bg-white rounded-[20px] border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center font-bold">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  Performance & Growth Analytics
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 uppercase tracking-wide">
                    Live
                  </span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  Filter timeline trajectory and top performers by timeframe and
                  metric
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Timeframe selector */}
              <div className="flex items-center gap-1 bg-[#FAFBFC] border border-neutral-200/60 p-1 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.02)]">
                <span className="text-[11px] font-semibold text-[#64748B] px-2 hidden sm:inline">
                  Timeframe:
                </span>
                {(["daily", "monthly", "yearly", "all"] as const).map((tf) => (
                  <Button
                    key={tf}
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-3 text-[11px] py-0 font-semibold rounded-lg transition-all capitalize ${
                      chartTimeframe === tf
                        ? "bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)] font-bold"
                        : "text-[#64748B] hover:text-[#16A34A]"
                    }`}
                    onClick={() => setChartTimeframe(tf)}
                  >
                    {tf === "all" ? "All Time" : tf}
                  </Button>
                ))}
              </div>

              {/* Metric selector */}
              <div className="flex items-center gap-1 bg-[#FAFBFC] border border-neutral-200/60 p-1 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.02)]">
                <span className="text-[11px] font-semibold text-[#64748B] px-2 hidden sm:inline">
                  Metric:
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 text-[11px] py-0 font-semibold rounded-lg transition-all ${
                    chartMetric === "revenue"
                      ? "bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)] font-bold"
                      : "text-[#64748B] hover:text-[#16A34A]"
                  }`}
                  onClick={() => setChartMetric("revenue")}
                >
                  Revenue Driven
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 text-[11px] py-0 font-semibold rounded-lg transition-all ${
                    chartMetric === "conversions"
                      ? "bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)] font-bold"
                      : "text-[#64748B] hover:text-[#16A34A]"
                  }`}
                  onClick={() => setChartMetric("conversions")}
                >
                  Conversions
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Growth Chart (2/3 width) */}
            <div className="bg-white rounded-[20px] border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/40 p-6">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2 text-[#0F172A]">
                    <BarChart3 className="h-5 w-5 text-[#16A34A]" />
                    RM Sales Growth Timeline
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track cumulative{" "}
                    {chartMetric === "revenue"
                      ? "revenue (₹)"
                      : "sales conversions"}{" "}
                    across all Relationship Managers •{" "}
                    {chartTimeframe === "all"
                      ? "All Time"
                      : chartTimeframe.toUpperCase()}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className="text-xs font-semibold border-emerald-200 bg-emerald-50 text-emerald-800 self-start sm:self-auto"
                >
                  {chartMetric === "revenue"
                    ? "Revenue Trajectory"
                    : "Conversions Trajectory"}
                </Badge>
              </div>
              <div className="p-6 pt-6 space-y-6">
                {/* RM toggles / filters */}
                {chartRmNames.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-[#FAFBFC] p-3 rounded-xl border border-neutral-200/40 text-[11px]">
                    <span className="font-semibold text-muted-foreground">
                      Toggle Series:
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 select-none">
                      <input
                        type="checkbox"
                        checked={selectedChartRMs.length === 0}
                        onChange={() => setSelectedChartRMs([])}
                        className="rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A] h-3.5 w-3.5"
                      />
                      <span className="font-bold text-[#0F172A]">
                        All Combined
                      </span>
                    </label>

                    {chartRmNames.map((name, index) => {
                      const isChecked = selectedChartRMs.includes(name);
                      const color = getRmColor(index);
                      return (
                        <label
                          key={name}
                          className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={
                              selectedChartRMs.length === 0 ? true : isChecked
                            }
                            onChange={() => handleToggleChartRm(name)}
                            className="rounded border-neutral-300 focus:ring-[#16A34A] h-3.5 w-3.5 text-[#16A34A]"
                            style={{ color }}
                          />
                          <span className="font-bold flex items-center gap-0.5 text-[#0F172A]">
                            <span
                              className="h-2 w-2 rounded-full inline-block mr-1"
                              style={{ backgroundColor: color }}
                            />
                            {name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Recharts Chart */}
                <div className="h-[280px] w-full text-xs flex items-center justify-center">
                  {allSales.length === 0 ||
                  chartData.length === 0 ||
                  chartRmNames.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 border border-dashed rounded-xl bg-[#FAFBFC] border-neutral-200/50 w-full h-full">
                      <BarChart3 className="h-10 w-10 text-muted-foreground/45" />
                      <p className="text-sm font-bold text-muted-foreground/80">
                        No sales data available yet
                      </p>
                      <p className="text-xs text-muted-foreground/60 max-w-sm">
                        Timeline and growth trends will automatically populate
                        here once clients make purchases using Relationship
                        Managers' referral codes.
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorTotal"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10B981"
                              stopOpacity={0.15}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10B981"
                              stopOpacity={0.01}
                            />
                          </linearGradient>
                          {chartRmNames.map((name, index) => {
                            const color = getRmColor(index);
                            return (
                              <linearGradient
                                key={name}
                                id={`colorRm-${index}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={color}
                                  stopOpacity={0.15}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={color}
                                  stopOpacity={0.01}
                                />
                              </linearGradient>
                            );
                          })}
                        </defs>

                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#E2E8F0"
                        />

                        <XAxis
                          dataKey="formattedDate"
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                          stroke="#888888"
                        />

                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          dx={-10}
                          stroke="#888888"
                          tickFormatter={(value) => {
                            if (chartMetric === "revenue") {
                              if (value >= 10000000)
                                return `₹${(value / 10000000).toFixed(1)}Cr`;
                              if (value >= 100000)
                                return `₹${(value / 100000).toFixed(1)}L`;
                              if (value >= 1000)
                                return `₹${(value / 1000).toFixed(0)}k`;
                              return `₹${value}`;
                            }
                            return String(value);
                          }}
                        />

                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.96)",
                            borderRadius: "12px",
                            border: "1px solid #E2E8F0",
                            boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
                          }}
                          labelClassName="font-bold text-gray-800"
                          formatter={(value: any, name: string) => {
                            const formattedValue =
                              chartMetric === "revenue"
                                ? `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                                : `${value} Conversions`;
                            return [formattedValue, name];
                          }}
                        />

                        {selectedChartRMs.length === 0 ? (
                          <>
                            <Area
                              type="monotone"
                              dataKey="All RMs Combined"
                              stroke="#10B981"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorTotal)"
                            />
                            {chartRmNames.map((name, index) => {
                              const color = getRmColor(index);
                              return (
                                <Area
                                  key={name}
                                  type="monotone"
                                  dataKey={name}
                                  stroke={color}
                                  strokeWidth={1.5}
                                  strokeDasharray="4 4"
                                  fillOpacity={0.05}
                                  fill={`url(#colorRm-${index})`}
                                />
                              );
                            })}
                          </>
                        ) : (
                          chartRmNames.map((name, index) => {
                            if (!selectedChartRMs.includes(name)) return null;
                            const color = getRmColor(index);
                            return (
                              <Area
                                key={name}
                                type="monotone"
                                dataKey={name}
                                stroke={color}
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill={`url(#colorRm-${index})`}
                              />
                            );
                          })
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Top 5 RMs Leaderboard (1/3 width) */}
            <div className="bg-white rounded-[20px] border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col justify-between lg:col-span-1">
              <div className="pb-4 border-b border-neutral-200/40 p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2 text-[#0F172A]">
                    <Award className="h-5 w-5 text-amber-500" />
                    Top RMs Leaderboard
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ranked by{" "}
                    {chartMetric === "revenue"
                      ? "sales revenue driven"
                      : "sales conversions"}{" "}
                    •{" "}
                    {chartTimeframe === "all"
                      ? "All Time"
                      : chartTimeframe.toUpperCase()}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold border-amber-200 text-amber-700 bg-amber-50 capitalize"
                >
                  {chartTimeframe === "all" ? "All Time" : chartTimeframe}
                </Badge>
              </div>
              <div className="p-6 pt-5 flex-1 flex flex-col justify-between">
                {topFiveRMs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                    <Users className="h-8 w-8 opacity-40 mb-2" />
                    <p className="text-xs font-medium">
                      No sales recorded for{" "}
                      {chartTimeframe === "all"
                        ? "any RM"
                        : `this period (${chartTimeframe})`}
                      .
                    </p>
                    {chartTimeframe !== "all" && (
                      <button
                        onClick={() => setChartTimeframe("all")}
                        className="text-[11px] text-[#16A34A] hover:underline font-semibold mt-1.5"
                      >
                        Switch to All Time
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topFiveRMs.map((rm, index) => {
                      const currentValue =
                        chartMetric === "revenue"
                          ? rm.totalRevenue
                          : rm.conversionsCount;
                      const percentage = Math.min(
                        (currentValue / maxRmPerformerValue) * 100,
                        100,
                      );
                      const color = getRmColor(index);

                      return (
                        <div key={rm.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-[#64748B] w-4 text-right flex-shrink-0">
                                {index + 1}.
                              </span>
                              <div className="truncate">
                                <span className="font-bold text-[#0F172A] text-xs truncate">
                                  {rm.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  {chartMetric === "revenue"
                                    ? `(${rm.conversionsCount} sales)`
                                    : `(₹${rm.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })})`}
                                </span>
                              </div>
                            </div>
                            <span className="font-bold font-mono text-xs text-[#0F172A] flex-shrink-0 ml-2">
                              {chartMetric === "revenue"
                                ? `₹${rm.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                                : `${rm.conversionsCount} sales`}
                            </span>
                          </div>

                          <div className="h-1.5 w-full bg-[#FAFBFC] border border-neutral-200/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 pt-3 border-t border-neutral-200/40 text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>Updated in real-time</span>
                  <span className="font-bold text-[#16A34A]"> Network</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Search & status bar */}
      <div className="bg-white rounded-[20px] border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]/60" />
            <Input
              type="text"
              placeholder="Search RM name or email..."
              value={rmSearchQuery}
              onChange={(e) => setRmSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#FAFBFC] border border-neutral-200/50 p-1 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.02)] w-full sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-300 hover:text-[#16A34A] flex-1 sm:flex-initial ${rmStatusFilter === "ALL" ? "bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : "text-[#64748B]"}`}
              onClick={() => setRmStatusFilter("ALL")}
            >
              All Status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-300 hover:text-[#16A34A] flex-1 sm:flex-initial ${rmStatusFilter === "ACTIVE" ? "bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : "text-[#64748B]"}`}
              onClick={() => setRmStatusFilter("ACTIVE")}
            >
              Active Only
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-300 hover:text-[#16A34A] flex-1 sm:flex-initial ${rmStatusFilter === "INACTIVE" ? "bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : "text-[#64748B]"}`}
              onClick={() => setRmStatusFilter("INACTIVE")}
            >
              Inactive Only
            </Button>
          </div>
        </div>
      </div>

      {/* RMs Listing Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
          <Table>
            <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
              <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
                {renderSortHeader("RM Name", "name")}
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 pl-4">
                  Email
                </TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">
                  Type & Parent
                </TableHead>
                {renderSortHeader("Conversions", "conversionsCount")}
                {renderSortHeader("Revenue Driven", "totalRevenue")}
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">
                  Status
                </TableHead>
                {renderSortHeader("Created Date", "createdAt")}
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 text-right pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRMs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-10 text-muted-foreground font-semibold"
                  >
                    No Relationship Managers found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRMs.map((rm, index) => (
                  <TableRow
                    key={rm.id}
                    className="border-b border-neutral-200/30 cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-300"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(
                        `/admin/relationship-managers/sales-popup?id=${rm.id}`,
                        `rm_sales_${rm.id}`,
                        "width=1200,height=900,status=no,menubar=no,resizable=yes,scrollbars=yes",
                      );
                    }}
                  >
                    <TableCell className="font-bold text-[#0F172A] text-sm py-4">
                      {rm.name}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-[#64748B] py-4">
                      {rm.email}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${rm.type === "INTERNAL_RM" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}
                        >
                          {rm.type === "INTERNAL_RM"
                            ? "Internal RM"
                            : "Distributor RM"}
                        </span>
                        <span className="text-xs text-[#64748B] font-medium">
                          {rm.parentName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100 font-mono">
                        {rm.conversionsCount} sales
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-[#0F172A] text-sm font-mono py-4">
                      ₹
                      {rm.totalRevenue.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="py-4">
                      {rm.status === "ACTIVE" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#ECFDF5] text-[#16A34A] text-xs font-semibold border border-[#16A34A]/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#F1F5F9] text-[#64748B] text-xs font-semibold border border-[#E2E8F0]">
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-[#64748B] py-4">
                      {new Date(rm.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell
                      className="text-right py-4 pr-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete RM"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRmToDelete(rm);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create RM Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-[20px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              Create New Relationship Manager
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#0F172A]">
                  RM Type
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => {
                    setFormData({
                      ...formData,
                      type: val as "INTERNAL_RM" | "DISTRIBUTOR_RM",
                      parentId: "",
                    });
                    setFormErrors((p) => ({ ...p, parentId: undefined }));
                  }}
                >
                  <SelectTrigger className="w-full h-10 rounded-[14px] border-neutral-200/60 bg-white text-sm text-[#0F172A]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-neutral-200/60">
                    <SelectItem value="INTERNAL_RM">Internal RM</SelectItem>
                    <SelectItem value="DISTRIBUTOR_RM">
                      Distributor RM
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[#0F172A]">
                  {formData.type === "INTERNAL_RM"
                    ? "Assign to Branch"
                    : "Assign to Distributor"}
                </Label>
                <Select
                  value={formData.parentId}
                  onValueChange={(val) => {
                    setFormData({ ...formData, parentId: val });
                    setFormErrors((p) => ({ ...p, parentId: undefined }));
                  }}
                >
                  <SelectTrigger
                    className={`w-full h-10 rounded-[14px] border-neutral-200/60 bg-white text-sm text-[#0F172A] ${formErrors.parentId ? "border-red-500" : ""}`}
                  >
                    <SelectValue
                      placeholder={`Select ${formData.type === "INTERNAL_RM" ? "Branch" : "Distributor"}`}
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-neutral-200/60 max-h-[200px]">
                    {formData.type === "INTERNAL_RM"
                      ? branches?.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))
                      : distributors?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
                {formErrors.parentId && (
                  <p className="text-sm text-red-500">{formErrors.parentId}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-sm font-semibold text-[#0F172A]"
              >
                RM Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setFormErrors((p) => ({ ...p, name: undefined }));
                }}
                placeholder="RM Name"
                className={`h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A] ${formErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-semibold text-[#0F172A]"
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setFormErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="rm@.com"
                className={`h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A] ${formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {formErrors.email && (
                <p className="text-sm text-red-500">{formErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-semibold text-[#0F172A]"
                >
                  Temporary Password
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newPass = generateRandomPassword(12);
                      setFormData((p) => ({ ...p, password: newPass }));
                      setFormErrors((p) => ({ ...p, password: undefined }));
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Generate Random
                  </button>
                  {formData.password && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(formData.password);
                        notify.success("Password copied to clipboard");
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="new-rm-password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setFormErrors((p) => ({ ...p, password: undefined }));
                  }}
                  placeholder="Min. 12 chars (Upper, Lower, Number, Special)"
                  className={`h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A] pr-10 ${formErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <PasswordStrengthIndicator password={formData.password} />
              {formErrors.password && (
                <p className="text-sm text-red-500">{formErrors.password}</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-lg h-10 px-4 border-neutral-200/60 font-semibold"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !formData.name ||
                !formData.email ||
                !formData.password ||
                isSaving
              }
              className="border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4"
            >
              {isSaving ? "Creating..." : "Create RM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!rmToDelete}
        onOpenChange={(open) => !open && setRmToDelete(null)}
      >
        <DialogContent className="rounded-[20px] bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Relationship Manager
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-[#64748B]">
              Are you sure you want to delete{" "}
              <span className="font-bold text-[#0F172A]">
                {rmToDelete?.name}
              </span>
              ?
            </p>
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Warning: This will permanently remove the relationship manager
              profile.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-lg h-9 px-4 font-semibold border-neutral-200/60"
              onClick={() => setRmToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              className="rounded-lg h-9 px-4 font-semibold bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
