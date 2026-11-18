'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useDistributors, NetworkUser } from '@/hooks/use-network-management';
import { notify } from '@/components/ui/floating-notification';
import { EditDistributorDialog } from '@/components/admin/edit-distributor-dialog';

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
import { Plus, Users, Search, Copy, CheckCircle2, Calendar, Ticket, IndianRupee, BarChart3, Loader2, ArrowUpDown, Award, Sparkles, Filter, Eye, EyeOff, Trash2, RefreshCw, Pencil } from 'lucide-react';
import { generateRandomPassword } from '@/lib/password-policy';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

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
  usedByUser?: { fullName: string; email: string; phone?: string | null } | null;
  order?: { quantity: number; totalAmount: number } | null;
  relationshipManager?: {
    id: string;
    name: string;
    email: string;
    distributorId?: string;
    distributor?: {
      id: string;
      name: string;
      email: string;
    } | null;
  } | null;
}

const getDistributorId = (c: any): string | null =>
  c?.distributorId ||
  c?.distributorRm?.distributorId ||
  c?.relationshipManager?.distributorId ||
  c?.relationshipManager?.distributor?.id ||
  null;

export default function DistributorsPage() {
  const router = useRouter();
  const { admin: currentAdmin } = useAdminAuth();

  // Guard
  useEffect(() => {
    if (currentAdmin) {
      if (currentAdmin.role !== 'SUPER_ADMIN') {
        router.push('/admin/dashboard');
      }
    }
  }, [currentAdmin, router]);

  const { data: distributors, isLoading, createDistributor, deleteDistributor, updateDistributor } = useDistributors();
  const activeDistributorsList = distributors;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [distributorToEdit, setDistributorToEdit] = useState<NetworkUser | null>(null);
  const [distributorToDelete, setDistributorToDelete] = useState<NetworkUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; password?: string; global?: string }>({});

  const handleOpenCreateModal = () => {
    const randomPassword = generateRandomPassword(12);
    setFormData({ name: '', email: '', password: randomPassword });
    setFormErrors({});
    setShowPassword(true);
    setIsModalOpen(true);
  };

  // Sales Growth Analytics States
  const [allSales, setAllSales] = useState<Coupon[]>([]);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'conversions'>('revenue');
  const [chartTimeframe, setChartTimeframe] = useState<'daily' | 'monthly' | 'yearly' | 'all'>('monthly');


  useEffect(() => {
    const fetchAllSales = async () => {
      setIsAnalyticsLoading(true);
      try {
        const response = await fetch('/api/stocks/coupons?rmId=all', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const couponsArray = Array.isArray(data) ? data : data.coupons || [];
          const distIds = new Set(activeDistributorsList.map((d) => d.id));
          // Filter to only include completed referred sales belonging to partner distributors
          const usedCoupons = couponsArray.filter((c: any) => {
            const cDistId = getDistributorId(c);
            return c.isUsed && cDistId && distIds.has(cDistId);
          });
          setAllSales(usedCoupons);
        }
      } catch (err) {
        console.error('Error fetching distributor sales:', err);
      } finally {
        setIsAnalyticsLoading(false);
      }
    };

    if (currentAdmin && currentAdmin.role === 'SUPER_ADMIN') {
      if (activeDistributorsList.length > 0) {
        fetchAllSales();
      } else {
        setAllSales([]);
      }
    }
  }, [currentAdmin, activeDistributorsList]);

  // Aggregate global sales chronologically by distributor name
  const getChartTimelineData = () => {
    if (allSales.length === 0) return { chartData: [], distNames: [] };

    // Create a map of Distributor ID to Name
    const distNameMap: Record<string, string> = {};
    distributors.forEach((d) => {
      distNameMap[d.id] = d.name;
    });

    // Parse all referred sales and associate with parent distributors
    const parsedSales = allSales
      .map((sale) => {
        const dateStr = sale.usedAt || sale.createdAt;
        const distId = getDistributorId(sale);
        const distName = distId ? (distNameMap[distId] || sale.relationshipManager?.distributor?.name) : null;
        if (!distName) return null;
        return {
          date: new Date(dateStr),
          distName,
          revenue: sale.order?.totalAmount || 0,
        };
      })
      .filter((s): s is { date: Date; distName: string; revenue: number } => s !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (parsedSales.length === 0) return { chartData: [], distNames: [] };

    // Group sales by selected period granularity
    const salesByPeriod: Record<string, Record<string, number>> = {};
    const distNamesSet = new Set<string>();

    parsedSales.forEach((sale) => {
      const yyyy = sale.date.getFullYear();
      const mm = String(sale.date.getMonth() + 1).padStart(2, '0');
      const dd = String(sale.date.getDate()).padStart(2, '0');
      
      let periodKey = '';
      if (chartTimeframe === 'daily') {
        periodKey = `${yyyy}-${mm}-${dd}`;
      } else if (chartTimeframe === 'yearly') {
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
        const valueToAdd = chartMetric === 'revenue' ? sale.revenue : 1;
        periodGroup[sale.distName] = (periodGroup[sale.distName] || 0) + valueToAdd;
      }
      distNamesSet.add(sale.distName);
    });

    const distNamesList = Array.from(distNamesSet);

    // Generate continuous list of periods from start to today
    const chartData: any[] = [];
    const sortedPeriods = Object.keys(salesByPeriod).sort();
    
    const firstPeriod = sortedPeriods[0];
    if (!firstPeriod) return { chartData: [], distNames: distNamesList };

    let startDate: Date;
    if (chartTimeframe === 'daily') {
      const parts = firstPeriod.split('-');
      startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2] || 1));
    } else if (chartTimeframe === 'monthly' || chartTimeframe === 'all') {
      const parts = firstPeriod.split('-');
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

    const current = new Date(startDate);
    while (current <= finalEndDate) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');

      let periodKey = '';
      let formattedDate = '';

      if (chartTimeframe === 'daily') {
        periodKey = `${yyyy}-${mm}-${dd}`;
        formattedDate = current.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      } else if (chartTimeframe === 'yearly') {
        periodKey = `${yyyy}`;
        formattedDate = current.toLocaleDateString('en-IN', { year: 'numeric' });
      } else {
        periodKey = `${yyyy}-${mm}`;
        formattedDate = current.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      }

      const periodValues = salesByPeriod[periodKey] || {};

      let periodTotalAll = 0;
      const dataPoint: any = {
        date: periodKey,
        formattedDate: formattedDate,
      };

      distNamesList.forEach((name) => {
        const val = periodValues[name] || 0;
        dataPoint[name] = val;
        periodTotalAll += val;
      });
      dataPoint['All Combined'] = periodTotalAll;

      chartData.push(dataPoint);

      // Increment safely based on timeframe
      if (chartTimeframe === 'daily') {
        current.setDate(current.getDate() + 1);
      } else if (chartTimeframe === 'yearly') {
        current.setDate(1);
        current.setMonth(0);
        current.setFullYear(current.getFullYear() + 1);
      } else {
        current.setDate(1);
        current.setMonth(current.getMonth() + 1);
      }
    }

    return { chartData, distNames: distNamesList };
  };

  const { chartData, distNames: chartDistNames } = getChartTimelineData();

  // Premium colors palette
  const PALETTE_COLORS = [
    '#10B981', // Emerald / Green (Primary Partner accent)
    '#3B82F6', // Blue
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#EF4444', // Red
  ];

  const getColor = (index: number) => {
    return PALETTE_COLORS[index % PALETTE_COLORS.length] || '#10B981';
  };

  // Main distributors search/filter/sort states
  const [distSearchQuery, setDistSearchQuery] = useState('');
  const [distStatusFilter, setDistStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortConfig, setSortConfig] = useState<{
    key: 'name' | 'conversionsCount' | 'totalRevenue' | 'createdAt';
    direction: 'asc' | 'desc';
  }>({ key: 'totalRevenue', direction: 'desc' });

  // Dynamically calculate performance metrics for each distributor from allSales
  const distributorPerformanceStats = activeDistributorsList.map((dist) => {
    const distCoupons = allSales.filter((c) => {
      const distId = getDistributorId(c);
      return distId === dist.id;
    });
    const conversionsCount = distCoupons.length;
    const totalRevenue = distCoupons.reduce((sum, c) => sum + (c.order?.totalAmount || 0), 0);
    return {
      ...dist,
      conversionsCount,
      totalRevenue,
    };
  });

  const filteredDistributors = distributorPerformanceStats.filter((dist) => {
    const nameMatch = dist.name.toLowerCase().includes(distSearchQuery.toLowerCase());
    const emailMatch = dist.email.toLowerCase().includes(distSearchQuery.toLowerCase());
    const statusMatch = distStatusFilter === 'ALL' || dist.status === distStatusFilter;
    return (nameMatch || emailMatch) && statusMatch;
  });

  const sortedDistributors = [...filteredDistributors].sort((a, b) => {
    const { key, direction } = sortConfig;
    let comparison = 0;

    if (key === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (key === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      comparison = (a[key] as number) - (b[key] as number);
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  const requestSort = (key: 'name' | 'conversionsCount' | 'totalRevenue' | 'createdAt') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Helper to filter sales by active timeframe for Top Performers
  const getSalesInTimeframe = (sales: Coupon[], timeframe: 'daily' | 'monthly' | 'yearly' | 'all') => {
    const now = new Date();
    return sales.filter((s) => {
      const d = new Date(s.createdAt);
      if (isNaN(d.getTime())) return false;
      if (timeframe === 'daily') {
        return d.toDateString() === now.toDateString();
      }
      if (timeframe === 'monthly') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (timeframe === 'yearly') {
        return d.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  };

  const timeframeSales = getSalesInTimeframe(allSales, chartTimeframe);

  // Top performers calculated with respect to active timeframe and metric
  const topDistributorStats = activeDistributorsList
    .map((dist) => {
      const distCoupons = timeframeSales.filter((c) => {
        return getDistributorId(c) === dist.id;
      });
      const conversionsCount = distCoupons.length;
      const totalRevenue = distCoupons.reduce((sum, c) => sum + (c.order?.totalAmount || 0), 0);
      return {
        ...dist,
        conversionsCount,
        totalRevenue,
      };
    })
    .filter((d) => (chartMetric === 'revenue' ? d.totalRevenue > 0 : d.conversionsCount > 0));

  const topFiveDistributors = [...topDistributorStats]
    .sort((a, b) => {
      if (chartMetric === 'revenue') {
        return b.totalRevenue - a.totalRevenue;
      }
      return b.conversionsCount - a.conversionsCount;
    })
    .slice(0, 5);

  const maxDistPerformerValue = Math.max(
    ...topFiveDistributors.map((d) => (chartMetric === 'revenue' ? d.totalRevenue : d.conversionsCount)),
    0
  ) || 1;

  const maxDistRevenue = Math.max(...distributorPerformanceStats.map((d) => d.totalRevenue), 0) || 1;

  const renderSortHeader = (label: string, key: 'name' | 'conversionsCount' | 'totalRevenue' | 'createdAt') => {
    const isSorted = sortConfig.key === key;
    return (
      <TableHead
        onClick={() => requestSort(key)}
        className="cursor-pointer hover:text-foreground select-none transition-colors"
      >
        <div className="flex items-center gap-1 font-semibold">
          {label}
          <ArrowUpDown className={`h-3 w-3 transition-transform ${isSorted ? 'opacity-100 text-primary' : 'opacity-40 hover:opacity-100'}`} />
        </div>
      </TableHead>
    );
  };

  const validateForm = () => {
    const errors: { name?: string; email?: string; password?: string } = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.name.trim())) {
      errors.name = 'Name can only contain letters and spaces';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    const result = await createDistributor(formData);
    setIsSaving(false);
    
    if (result?.success) {
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '' });
      setFormErrors({});
      setShowPassword(false);
    } else {
      setFormErrors({ global: result?.message || 'Failed to create distributor' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!distributorToDelete) return;
    setIsDeleting(true);
    await deleteDistributor(distributorToDelete.id);
    setIsDeleting(false);
    setDistributorToDelete(null);
  };



  if (!currentAdmin || currentAdmin.role !== 'SUPER_ADMIN') {
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
            Distributor Network
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-50 text-[#64748B] border border-neutral-200/40 ml-1">
              {activeDistributorsList.length} active
            </span>
          </h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Manage partner distributors. Distributors can provision RMs to drive unlisted stock sales.
          </p>
        </div>
      </div>

      {/* KPI Cards Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="group flex items-center justify-between py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
        >
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Active Distributors</p>
            <h3 className="text-2xl font-bold text-[#0F172A] tracking-tight leading-none mt-1.5">
              {activeDistributorsList.filter((d) => d.status === 'ACTIVE').length} <span className="text-sm font-normal text-[#64748B]">/ {activeDistributorsList.length} total</span>
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 transition-colors duration-300 ease-in-out group-hover:bg-[#DCFCE7]">
            <Users className="h-4.5 w-4.5" />
          </div>
        </div>

        <div 
          className="group flex items-center justify-between py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
        >
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Overall Distributor Conversions</p>
            <h3 className="text-2xl font-bold text-[#0F172A] tracking-tight leading-none mt-1.5">
              {allSales.filter((s) => s.relationshipManager?.distributor?.id !== undefined).length} <span className="text-xs text-[#16A34A] font-bold bg-[#DCFCE7] px-2 py-0.5 rounded-lg border border-[#16A34A]/20 ml-1.5">sales</span>
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 transition-colors duration-300 ease-in-out group-hover:bg-[#DCFCE7]">
            <Ticket className="h-4.5 w-4.5" />
          </div>
        </div>

        <div 
          className="group flex items-center justify-between py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
        >
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Total Revenue Driven</p>
            <h3 className="text-2xl font-bold text-[#16A34A] tracking-tight leading-none mt-1.5">
              ₹{allSales.filter((s) => s.relationshipManager?.distributor?.id !== undefined).reduce((sum, c) => sum + (c.order?.totalAmount || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 transition-colors duration-300 ease-in-out group-hover:bg-[#DCFCE7]">
            <IndianRupee className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      {!isAnalyticsLoading && allSales.length > 0 && (
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
                  Filter timeline trajectory and top performers by timeframe and metric
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Timeframe Selector */}
              <div className="flex items-center gap-1 bg-[#FAFBFC] border border-neutral-200/60 p-1 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.02)]">
                <span className="text-[11px] font-semibold text-[#64748B] px-2 hidden sm:inline">Timeframe:</span>
                {(['daily', 'monthly', 'yearly', 'all'] as const).map((tf) => (
                  <Button
                    key={tf}
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-3 text-[11px] py-0 font-semibold rounded-lg transition-all capitalize ${
                      chartTimeframe === tf
                        ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)] font-bold'
                        : 'text-[#64748B] hover:text-[#16A34A]'
                    }`}
                    onClick={() => setChartTimeframe(tf)}
                  >
                    {tf === 'all' ? 'All Time' : tf}
                  </Button>
                ))}
              </div>

              {/* Metric Selector */}
              <div className="flex items-center gap-1 bg-[#FAFBFC] border border-neutral-200/60 p-1 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.02)]">
                <span className="text-[11px] font-semibold text-[#64748B] px-2 hidden sm:inline">Metric:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 text-[11px] py-0 font-semibold rounded-lg transition-all ${
                    chartMetric === 'revenue'
                      ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)] font-bold'
                      : 'text-[#64748B] hover:text-[#16A34A]'
                  }`}
                  onClick={() => setChartMetric('revenue')}
                >
                  Revenue Driven
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 text-[11px] py-0 font-semibold rounded-lg transition-all ${
                    chartMetric === 'conversions'
                      ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)] font-bold'
                      : 'text-[#64748B] hover:text-[#16A34A]'
                  }`}
                  onClick={() => setChartMetric('conversions')}
                >
                  Conversions
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline Chart */}
            <div className="bg-white rounded-[20px] border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/40 p-6">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2 text-[#0F172A]">
                    <BarChart3 className="h-5 w-5 text-[#16A34A]" />
                    Distributors Sales growth Timeline
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track {chartMetric === 'revenue' ? 'revenue (₹)' : 'sales conversions'} across all partner Distributors • {chartTimeframe === 'all' ? 'All Time' : chartTimeframe.toUpperCase()}
                  </p>
                </div>

                <Badge variant="outline" className="text-xs font-semibold border-emerald-200 bg-emerald-50 text-emerald-800 self-start sm:self-auto">
                  {chartMetric === 'revenue' ? 'Sales Revenue' : 'Sales Conversions'}
                </Badge>
              </div>
            <div className="p-6 pt-6 space-y-6">

              {/* Recharts chart */}
              <div className="h-[280px] w-full text-xs flex items-center justify-center">
                {allSales.length === 0 || chartData.length === 0 || chartDistNames.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 border border-dashed rounded-xl bg-[#FAFBFC] border-neutral-200/50 w-full h-full">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/45" />
                    <p className="text-sm font-bold text-muted-foreground/80">No sales data available yet</p>
                    <p className="text-xs text-muted-foreground/60 max-w-sm">
                      Timeline and growth trends will automatically populate here once clients make purchases using Distributor RMs' referral codes.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.01}/>
                        </linearGradient>
                        {chartDistNames.map((name, index) => {
                          const color = getColor(index);
                          return (
                            <linearGradient key={name} id={`colorDist-${index}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={color} stopOpacity={0.01}/>
                            </linearGradient>
                          );
                        })}
                      </defs>
                      
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      
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
                          if (chartMetric === 'revenue') {
                            if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
                            if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
                            if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
                            return `₹${value}`;
                          }
                          return String(value);
                        }}
                      />
                      
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.96)',
                          borderRadius: '12px',
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 8px 30px rgba(15,23,42,0.08)',
                        }}
                        labelClassName="font-bold text-gray-800"
                        formatter={(value: any, name: string) => {
                          const formattedValue = chartMetric === 'revenue' 
                            ? `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : `${value} Conversions`;
                          return [formattedValue, name];
                        }}
                      />
                      
                      <Area
                        type="monotone"
                        dataKey="All Combined"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                      />
                      {chartDistNames.map((name, index) => {
                        const color = getColor(index);
                        return (
                          <Area
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={color}
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            fillOpacity={0.05}
                            fill={`url(#colorDist-${index})`}
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Leaderboard Card */}
          <div className="bg-white rounded-[20px] border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col justify-between lg:col-span-1">
            <div className="pb-4 border-b border-neutral-200/40 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-[#0F172A]">
                  <Award className="h-5 w-5 text-amber-500" />
                  Top Distributors
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ranked by {chartMetric === 'revenue' ? 'sales revenue driven' : 'sales conversions'} • {chartTimeframe === 'all' ? 'All Time' : chartTimeframe.toUpperCase()}
                </p>
              </div>
              <Badge variant="outline" className="text-[11px] font-semibold border-amber-200 text-amber-700 bg-amber-50 capitalize">
                {chartTimeframe === 'all' ? 'All Time' : chartTimeframe}
              </Badge>
            </div>
            <div className="p-6 pt-5 flex-1 flex flex-col justify-between">
              {topFiveDistributors.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Users className="h-8 w-8 opacity-40 mb-2" />
                  <p className="text-xs font-medium">No sales recorded for {chartTimeframe === 'all' ? 'any distributor' : `this period (${chartTimeframe})`}.</p>
                  {chartTimeframe !== 'all' && (
                    <button
                      onClick={() => setChartTimeframe('all')}
                      className="text-[11px] text-[#16A34A] hover:underline font-semibold mt-1.5"
                    >
                      Switch to All Time
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {topFiveDistributors.map((dist, index) => {
                    const currentValue = chartMetric === 'revenue' ? dist.totalRevenue : dist.conversionsCount;
                    const percentage = Math.min((currentValue / maxDistPerformerValue) * 100, 100);
                    const color = getColor(index);
                    
                    return (
                      <div key={dist.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-[#64748B] w-4 text-right flex-shrink-0">
                              {index + 1}.
                            </span>
                            <div className="truncate">
                              <span className="font-bold text-[#0F172A] text-xs truncate">{dist.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">
                                {chartMetric === 'revenue' 
                                  ? `(${dist.conversionsCount} sales)` 
                                  : `(₹${dist.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`}
                              </span>
                            </div>
                          </div>
                          <span className="font-bold font-mono text-xs text-[#0F172A] flex-shrink-0 ml-2">
                            {chartMetric === 'revenue'
                              ? `₹${dist.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                              : `${dist.conversionsCount} sales`}
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
                <span className="font-bold text-[#16A34A]">SMC Network</span>
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
              placeholder="Search Distributor name or email..."
              value={distSearchQuery}
              onChange={(e) => setDistSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
          </div>
          
          <div className="flex items-center gap-1 bg-[#FAFBFC] border border-neutral-200/50 p-1 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.02)] w-full sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-300 hover:text-[#16A34A] flex-1 sm:flex-initial ${distStatusFilter === 'ALL' ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'text-[#64748B]'}`}
              onClick={() => setDistStatusFilter('ALL')}
            >
              All Status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-300 hover:text-[#16A34A] flex-1 sm:flex-initial ${distStatusFilter === 'ACTIVE' ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'text-[#64748B]'}`}
              onClick={() => setDistStatusFilter('ACTIVE')}
            >
              Active Only
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all duration-300 hover:text-[#16A34A] flex-1 sm:flex-initial ${distStatusFilter === 'INACTIVE' ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'text-[#64748B]'}`}
              onClick={() => setDistStatusFilter('INACTIVE')}
            >
              Inactive Only
            </Button>
          </div>
        </div>
        
        <Button 
          onClick={handleOpenCreateModal} 
          size="sm" 
          className="h-10 px-4 self-start md:self-auto shrink-0 border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Create Distributor
        </Button>
      </div>

      {/* Distributors Listing Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
          <Table>
            <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
              <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
                {renderSortHeader('Distributor Name', 'name')}
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 pl-4">Email</TableHead>
                {renderSortHeader('Conversions', 'conversionsCount')}
                {renderSortHeader('Revenue Driven', 'totalRevenue')}
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Status</TableHead>
                {renderSortHeader('Created Date', 'createdAt')}
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDistributors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground font-semibold">
                    No Distributors found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                sortedDistributors.map((dist) => (
                  <TableRow
                    key={dist.id}
                    className="border-b border-neutral-200/30 cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-300"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(
                        `/admin/distributors/sales-popup?id=${dist.id}`,
                        `distributor_sales_${dist.id}`,
                        'width=1200,height=900,status=no,menubar=no,resizable=yes,scrollbars=yes'
                      );
                    }}
                  >
                    <TableCell className="font-bold text-[#0F172A] text-sm py-4">{dist.name}</TableCell>
                    <TableCell className="text-sm font-semibold text-[#64748B] py-4">{dist.email}</TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100 font-mono">
                        {dist.conversionsCount} sales
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-[#0F172A] text-sm font-mono py-4">
                      ₹{dist.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-4">
                      {dist.status === 'ACTIVE' ? (
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
                      {new Date(dist.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right py-4 pr-6" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 mr-1 text-[#64748B] hover:text-[#16A34A] hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit Distributor"
                        aria-label={`Edit ${dist.name}`}
                        onClick={() => setDistributorToEdit(dist)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Distributor"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDistributorToDelete(dist);
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

      {distributorToEdit && (
        <EditDistributorDialog
          key={distributorToEdit.id}
          distributorId={distributorToEdit.id}
          onClose={() => setDistributorToEdit(null)}
          onSave={updateDistributor}
        />
      )}

      {/* Create Distributor Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-[20px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">Create New Distributor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formErrors.global && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                {formErrors.global}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-[#0F172A]">Distributor Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors((p) => ({ ...p, name: undefined })); }}
                placeholder="Acme Dist."
                className={`h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A] ${formErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-[#0F172A]">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFormErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="contact@acmedist.com"
                className={`h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A] ${formErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {formErrors.email && <p className="text-sm text-red-500">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold text-[#0F172A]">Temporary Password</Label>
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
                  name="new-distributor-password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFormErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="Min. 8 characters"
                  className={`h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A] pr-10 ${formErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={formData.password} />
              {formErrors.password && <p className="text-sm text-red-500">{formErrors.password}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg h-10 px-4 border-neutral-200/60 font-semibold" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!formData.name || !formData.email || !formData.password || isSaving}
              className="border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4"
            >
              {isSaving ? "Creating..." : "Create Distributor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!distributorToDelete} onOpenChange={(open) => !open && setDistributorToDelete(null)}>
        <DialogContent className="rounded-[20px] bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Distributor
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-[#64748B]">
              Are you sure you want to delete <span className="font-bold text-[#0F172A]">{distributorToDelete?.name}</span>?
            </p>
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Warning: This will permanently remove the distributor account and all associated relationship manager profiles.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-lg h-9 px-4 font-semibold border-neutral-200/60"
              onClick={() => setDistributorToDelete(null)}
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
