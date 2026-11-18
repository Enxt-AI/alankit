'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuditLog } from '@/types/content';
import { Eye, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLogsTableProps {
  auditLogs: AuditLog[];
  isLoading?: boolean;
  title?: string;
  showFilters?: boolean;
  pageSize?: number;
  showPagination?: boolean;
}

const getActionBadgeClass = (action: AuditLog['action']) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors";
  switch (action) {
    case 'CREATE':
    case 'PUBLISH':
      return `${base} bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20`;
    case 'UPDATE':
      return `${base} bg-[#EFF6FF] text-[#3B82F6] border-[#3B82F6]/20`;
    case 'DELETE':
    case 'UNPUBLISH':
      return `${base} bg-red-50 text-red-600 border-red-200/60`;
    case 'ROLLBACK':
      return `${base} bg-[#FEF3C7] text-[#D97706] border-[#F59E0B]/20`;
    default:
      return `${base} bg-neutral-50 text-[#64748B] border-neutral-200/60`;
  }
};

const getEntityTypeLabel = (entityType: AuditLog['entity']) => {
  switch (entityType) {
    case 'STATIC_PAGE':
      return 'Static Page';
    case 'CONTENT':
      return 'Content';
    case 'FAQ':
      return 'FAQ';
    case 'STOCK':
      return 'Stock';
    case 'ORDER':
      return 'Order';
    case 'PORTFOLIO':
      return 'Portfolio';
    default:
      return entityType;
  }
};

export function AuditLogsTable({
  auditLogs,
  isLoading,
  title = 'Audit Logs',
  showFilters = false,
  pageSize = 10,
  showPagination = true
}: AuditLogsTableProps) {
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  // Filter and search logic
  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    
    return auditLogs.filter(log => {
      const matchesSearch = searchTerm === '' || 
        log.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.entityId && log.entityId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.changes && JSON.stringify(log.changes).toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesEntity = entityFilter === 'all' || log.entity === entityFilter;
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      
      return matchesSearch && matchesEntity && matchesAction;
    });
  }, [auditLogs, searchTerm, entityFilter, actionFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, entityFilter, actionFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!auditLogs || auditLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center">
        <p className="text-sm font-semibold text-[#0F172A]">No Audit Logs Found</p>
        <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
          There are no logs to show in this view.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              placeholder="Search by email, entity ID, or changes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 w-full"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-full sm:w-48 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 rounded-[14px] bg-white text-gray-900 outline-none transition-all duration-300">
              <SelectValue placeholder="Filter by entity" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-neutral-200 shadow-lg">
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="STATIC_PAGE">Static Page</SelectItem>
              <SelectItem value="CONTENT">Content</SelectItem>
              <SelectItem value="FAQ">FAQ</SelectItem>
              <SelectItem value="STOCK">Stock</SelectItem>
              <SelectItem value="ORDER">Order</SelectItem>
              <SelectItem value="PORTFOLIO">Portfolio</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-48 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 rounded-[14px] bg-white text-gray-900 outline-none transition-all duration-300">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-neutral-200 shadow-lg">
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="ROLLBACK">Rollback</SelectItem>
              <SelectItem value="PUBLISH">Publish</SelectItem>
              <SelectItem value="UNPUBLISH">Unpublish</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center">
          <p className="text-sm font-semibold text-[#0F172A]">No Match Found</p>
          <p className="text-xs text-[#64748B] mt-1">
            Try adjusting your search filters.
          </p>
        </div>
      ) : (
        <>
          {/* Table Container */}
          <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
            <Table>
              <TableHeader className="bg-[#FAFBFC]">
                <TableRow className="hover:bg-transparent border-b border-neutral-100">
                  <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 pl-6">Timestamp</TableHead>
                  <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Admin</TableHead>
                  <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Entity</TableHead>
                  <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Action</TableHead>
                  <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 text-right pr-6">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-[#F8FAFC] transition-colors border-b border-neutral-100/60">
                    <TableCell className="text-sm font-medium text-[#64748B] py-4 pl-6">
                      {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <div className="font-semibold text-sm text-[#0F172A]">{log.adminEmail}</div>
                        <div className="text-[11px] font-medium text-[#64748B] mt-0.5">{log.adminRole}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <div className="font-semibold text-sm text-[#0F172A]">{getEntityTypeLabel(log.entity)}</div>
                        <div className="text-[11px] font-mono text-[#64748B] mt-0.5">{log.entityId}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className={getActionBadgeClass(log.action)}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                        className={cn(
                          "h-8 w-8 text-[#64748B] rounded-lg transition-all duration-200",
                          showDetails === log.id 
                            ? "text-[#16A34A] bg-[#ECFDF5]" 
                            : "hover:text-[#16A34A] hover:bg-[#ECFDF5]"
                        )}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {showPagination && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs font-semibold text-[#64748B]">
                Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredLogs.length)} of {filteredLogs.length} audit logs
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          pageNum === currentPage
                            ? "bg-[#16A34A] text-white border border-[#16A34A] rounded-xl font-bold text-xs px-3 py-1.5 h-8 min-w-[32px] transition-all duration-300 ease-in-out cursor-default"
                            : "bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 h-8 min-w-[32px] transition-all duration-300 ease-in-out active:scale-[0.98]"
                        )}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Details Panel */}
          {showDetails && (
            <div className="p-5 bg-[#FAFBFC] rounded-[20px] border border-neutral-200/50 shadow-inner mt-4">
              <h4 className="text-sm font-bold text-[#0F172A] mb-3">Change Details</h4>
              {(() => {
                const log = filteredLogs.find(log => log.id === showDetails);
                if (!log?.changes) return <p className="text-xs text-[#64748B]">No change details available</p>;
                
                const changes = log.changes;
                const changeEntries = Object.entries(changes);
                
                if (changeEntries.length === 0) {
                  return <p className="text-xs text-[#64748B]">No changes recorded</p>;
                }
                
                return (
                  <div className="space-y-3">
                    {changeEntries.map(([field, value]) => (
                      <div key={field} className="bg-white p-4 rounded-[14px] border border-neutral-200/30">
                        <div className="font-semibold text-xs text-[#0F172A] mb-1.5">{field}</div>
                        <pre className="text-xs font-mono bg-[#FAFBFC] p-3 rounded-xl border border-neutral-200/20 overflow-auto whitespace-pre-wrap break-all text-[#475569]">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </pre>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}