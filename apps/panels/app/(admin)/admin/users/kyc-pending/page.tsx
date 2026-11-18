'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { KycDetailDialog } from '@/components/admin/kyc-detail-dialog';

/**
 * Admin page for reviewing pending KYC submissions
 * Displays only users with kycStatus='PENDING' AND a submittedAt timestamp.
 * This avoids listing brand-new users whose default status may still be PENDING.
 * Search functionality available for name, email, or phone
 */
export default function AdminKycPendingPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 500);
    return () => clearTimeout(timer);
  };

  // Fetch only PENDING users with search filter
  const { data: users, isLoading, error, refetch } = useAdminUsers({
    kycStatus: 'PENDING',
    submittedOnly: true,
    search: debouncedSearch || undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">KYC Review</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve pending KYC submissions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border rounded-md bg-muted/30">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            SUBMITTED PENDING
          </Badge>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <AdminTableSkeleton rows={5} columns={6} />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500">Error loading pending KYC: {error.message}</p>
          <Button onClick={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </div>
      ) : !users || users.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">
            {debouncedSearch
              ? 'No pending KYC submissions found matching your search'
              : 'No pending KYC submissions to review'}
          </p>
          {debouncedSearch && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              className="mt-4"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Demat Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <TableCell className="font-medium">{user.fullName || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(user.updatedAt), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    {user.dematStatus === 'VERIFIED' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                        ✓ Verified
                      </span>
                    ) : user.dematStatus === 'PENDING' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-50 text-yellow-700 text-xs font-medium border border-yellow-200">
                        Pending
                      </span>
                    ) : user.dematStatus === 'REJECTED' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                        Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200">
                        Not Linked
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserId(user.id);
                      }}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* KYC Detail Dialog */}
      <KycDetailDialog
        userId={selectedUserId}
        open={!!selectedUserId}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
      />
    </div>
  );
}
