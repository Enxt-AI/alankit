'use client';

/**
 * Audit Logs Dashboard Page
 *
 * Displays recent audit logs and provides filtering capabilities
 * Accessible to admins with appropriate permissions
 */

import { useState } from 'react';
import { useRecentAuditLogs } from '@/hooks/use-audit';
import { AuditLogsTable } from '@/components/audit/audit-logs-table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { useCMSAdmin } from '@/store/auth-store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export default function AuditLogsPage() {
  const { cmsAdmin, isCMSLoading } = useCMSAdmin();
  const [activeTab, setActiveTab] = useState('recent');
  const [showFilters, setShowFilters] = useState(true);
  const { data: recentLogs, isLoading, refetch } = useRecentAuditLogs(50);

  // Check if user has permission to view audit logs
  if (isCMSLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16A34A]"></div>
      </div>
    );
  }

  const hasAuditPermission = cmsAdmin?.permissions?.includes('create_admins') || cmsAdmin?.role === 'SUPER_ADMIN';

  if (!hasAuditPermission) {
    return (
      <div className="space-y-6 py-2">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Audit Logs</h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Monitor and track all administrative actions across the system
            </p>
          </div>
        </div>

        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to view audit logs. Contact your administrator to enable <code className="bg-red-100 px-1 py-0.5 rounded text-xs font-semibold text-red-800">create_admins</code> permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Audit Logs</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Monitor and track all administrative actions across the system
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            className="h-10 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out active:scale-[0.98] flex items-center gap-2 outline-none"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-10 border text-sm px-4 py-2 rounded-xl font-semibold transition-all duration-300 ease-in-out active:scale-[0.98] flex items-center gap-2 outline-none",
              showFilters 
                ? "bg-[#ECFDF5] border-[#16A34A] text-[#0F172A]" 
                : "bg-white border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A]"
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="inline-flex h-[38px] items-center gap-1.5 rounded-xl bg-[#FAFBFC] border border-neutral-200/50 p-1 shadow-[0_1px_3px_rgba(15,23,42,0.02)]">
          <TabsTrigger 
            value="recent"
            className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[#64748B] transition-all duration-250 data-[state=active]:bg-white data-[state=active]:text-[#16A34A] data-[state=active]:shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:text-[#16A34A]"
          >
            Recent Activity
          </TabsTrigger>
          <TabsTrigger 
            value="by-entity"
            className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[#64748B] transition-all duration-250 data-[state=active]:bg-white data-[state=active]:text-[#16A34A] data-[state=active]:shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:text-[#16A34A]"
          >
            By Entity
          </TabsTrigger>
          <TabsTrigger 
            value="by-admin"
            className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[#64748B] transition-all duration-250 data-[state=active]:bg-white data-[state=active]:text-[#16A34A] data-[state=active]:shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:text-[#16A34A]"
          >
            By Admin
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4 outline-none">
          <AuditLogsTable
            auditLogs={recentLogs || []}
            isLoading={isLoading}
            showFilters={showFilters}
            title=""
          />
        </TabsContent>

        <TabsContent value="by-entity" className="space-y-4 outline-none">
          <div 
            className="bg-white rounded-[20px] border border-neutral-200/40 p-6"
            style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
          >
            <h3 className="text-base font-semibold text-[#0F172A]">Audit Logs by Entity Type</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Select an entity type to view its audit logs.
            </p>
            <div className="mt-8 text-center py-8 border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50">
              <p className="text-xs text-[#64748B]">Entity filter implementation coming soon. Use general table filters above.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="by-admin" className="space-y-4 outline-none">
          <div 
            className="bg-white rounded-[20px] border border-neutral-200/40 p-6"
            style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
          >
            <h3 className="text-base font-semibold text-[#0F172A]">Audit Logs by Admin</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Select an admin to view their audit logs.
            </p>
            <div className="mt-8 text-center py-8 border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50">
              <p className="text-xs text-[#64748B]">Admin filter implementation coming soon. Use general table filters above.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}