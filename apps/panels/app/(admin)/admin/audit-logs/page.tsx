'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { getAuditLogsAdmin } from '@/lib/admin-api';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { admin } = useAuthStore();
  const router = useRouter();

  // Protect route client-side
  useEffect(() => {
    if (admin && admin.role !== 'SUPER_ADMIN') {
      router.replace('/admin/dashboard');
    }
  }, [admin, router]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAuditLogsAdmin();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Audit Logs</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Track database changes and admin actions across the platform.
          </p>
        </div>
        <Button
          onClick={fetchLogs}
          disabled={isLoading}
          className="border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={8} columns={5} />
      ) : error ? (
        <div className="text-center py-12 text-red-500 border border-neutral-200/40 rounded-[20px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <p className="font-bold">{error}</p>
          <Button onClick={fetchLogs} className="mt-4 border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4">
            Try Again
          </Button>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-8 border border-neutral-200/40 rounded-[20px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-4">
            <RefreshCw className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A]">No Audit Logs Found</h3>
          <p className="text-sm text-[#64748B] mt-1.5 max-w-sm">
            There are no admin activity or platform logs recorded yet.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
          <Table>
            <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
              <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 pl-6">Timestamp</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Admin</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Action</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5">Entity</TableHead>
                <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3.5 pr-6">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="border-b border-neutral-200/30 hover:bg-[#F8FAFC] transition-colors duration-300">
                  <TableCell className="whitespace-nowrap font-bold text-sm text-[#0F172A] py-4 pl-6">
                    {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm text-[#0F172A]">{log.adminEmail}</span>
                      <span className="text-xs font-semibold text-[#64748B]">{log.adminRole}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${log.action === 'DELETE' ? 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20' : 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20'}`}>
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm text-[#0F172A]">{log.entity}</span>
                      {log.entityId && (
                        <span className="text-xs font-mono text-[#64748B] truncate max-w-[150px]">
                          ID: {log.entityId}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 pr-6">
                    <div className="max-h-24 overflow-y-auto text-xs font-mono bg-[#FAFBFC] border border-neutral-200/40 p-2.5 rounded-xl max-w-xs break-all text-[#64748B]">
                      {log.changes ? JSON.stringify(log.changes, null, 2) : '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
