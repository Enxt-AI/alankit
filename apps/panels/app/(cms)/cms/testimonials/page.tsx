'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  MessageSquareQuote,
  AlertCircle,
} from 'lucide-react';
import { useTestimonials } from '@/hooks/use-testimonials';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import { TestimonialForm } from '@/components/admin/testimonial-form';
import { TestimonialDeleteDialog } from '@/components/admin/testimonial-delete-dialog';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { cn } from '@/lib/utils';
import { Testimonial } from '@/types/testimonial';

/**
 * CMS Testimonials management page.
 *
 * Features:
 *   - Lists all testimonials (active + inactive) in a table
 *   - Search across name, designation, company, and feedback
 *   - Pagination (10 per page)
 *   - Create / Edit / Delete modals
 *   - Permission gating via cms_testimonials
 */
export default function CMSTestimonialsPage() {
  // ---------------------------------------------------------------------------
  // Auth & permissions
  // ---------------------------------------------------------------------------
  const { cmsAdmin } = useCMSAuth();
  const hasTestimonialsPermission =
    cmsAdmin?.permissions?.includes('cms_testimonials') ||
    cmsAdmin?.role === 'SUPER_ADMIN';

  // Early return if the current admin lacks the required permission
  if (!hasTestimonialsPermission) {
    return (
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              CMS Testimonials
            </h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Manage client testimonials displayed on the landing page
            </p>
          </div>
        </div>

        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to access testimonial management.
            Contact your administrator to enable{' '}
            <code className="bg-neutral-100 text-[#0F172A] px-2 py-1 rounded-[6px] text-xs font-mono border border-neutral-200/50">
              cms_testimonials
            </code>{' '}
            permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const {
    data: testimonials = [],
    isLoading,
    error,
    refetch,
  } = useTestimonials(true, true); // enabled=true, useCmsEndpoint=true

  const canManageTestimonials =
    cmsAdmin?.permissions?.includes('cms_testimonials') ||
    cmsAdmin?.role === 'SUPER_ADMIN' ||
    false;

  // ---------------------------------------------------------------------------
  // Search state
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // ---------------------------------------------------------------------------
  // Pagination state
  // ---------------------------------------------------------------------------
  const [page, setPage] = useState(1);
  const perPage = 10;

  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedTestimonial, setSelectedTestimonial] = useState<
    Testimonial | undefined
  >();

  // ---------------------------------------------------------------------------
  // Debounce search input (300ms)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(searchQuery);
      setPage(1); // Reset to first page whenever search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Filter testimonials by search query (name, designation, company, feedback)
  // ---------------------------------------------------------------------------
  const filteredTestimonials = testimonials.filter((t) => {
    const query = debounced.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      t.designation.toLowerCase().includes(query) ||
      t.company.toLowerCase().includes(query) ||
      t.feedback.toLowerCase().includes(query)
    );
  });

  // ---------------------------------------------------------------------------
  // Paginate
  // ---------------------------------------------------------------------------
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTestimonials.length / perPage),
  );
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedTestimonials = filteredTestimonials.slice(
    startIndex,
    endIndex,
  );

  // Clamp current page when total pages shrinks (e.g. after deletion or filter)
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  // ---------------------------------------------------------------------------
  // Modal handlers
  // ---------------------------------------------------------------------------
  const handleCreate = () => {
    setFormMode('create');
    setSelectedTestimonial(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (testimonial: Testimonial) => {
    setFormMode('edit');
    setSelectedTestimonial(testimonial);
    setIsFormOpen(true);
  };

  const handleDelete = (testimonial: Testimonial) => {
    setSelectedTestimonial(testimonial);
    setIsDeleteOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Truncate long text with an ellipsis suffix. */
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
            CMS Testimonials
          </h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Manage client testimonials displayed on the landing page
          </p>
        </div>
      </div>

      {/* Search bar + Create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            placeholder="Search testimonials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300"
          />
        </div>
        {canManageTestimonials && (
          <Button 
            onClick={handleCreate}
            className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
          >
            <Plus className="h-4 w-4" />
            Create Testimonial
          </Button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <AdminTableSkeleton
          rows={5}
          columns={6}
          showActions={canManageTestimonials}
        />
      )}

      {/* Error state */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex items-center justify-between text-red-800 w-full">
            <span>{error.message}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-xl border-red-200 text-red-800 hover:bg-red-100/50"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredTestimonials.length === 0 && (
        <div 
          className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center"
          style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
        >
          <MessageSquareQuote className="mb-3 h-8 w-8 text-[#64748B]" />
          <h3 className="text-sm font-semibold text-[#0F172A]">
            No Testimonials Found
          </h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
            {searchQuery
              ? 'Try adjusting your search query.'
              : 'Create your first testimonial to get started.'}
          </p>
          {canManageTestimonials && !searchQuery && (
            <Button 
              onClick={handleCreate}
              className="mt-4 h-9 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] rounded-xl font-semibold text-xs px-3.5 py-1.5 transition-all duration-300 ease-in-out flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Testimonial
            </Button>
          )}
        </div>
      )}

      {/* Testimonials Table */}
      {!isLoading && !error && filteredTestimonials.length > 0 && (
        <>
          <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
            <Table>
              <TableHeader className="bg-[#FAFBFC]">
                <TableRow className="hover:bg-transparent border-b border-neutral-100">
                  <TableHead className="w-[160px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 pl-6">Name</TableHead>
                  <TableHead className="w-[140px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Designation</TableHead>
                  <TableHead className="w-[140px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Company</TableHead>
                  <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Feedback</TableHead>
                  <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Status</TableHead>
                  <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Created</TableHead>
                  {canManageTestimonials && (
                    <TableHead className="w-[100px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 text-right pr-6">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTestimonials.map((testimonial) => (
                  <TableRow key={testimonial.id} className="hover:bg-[#F8FAFC] transition-colors border-b border-neutral-100/60">
                    <TableCell className="font-semibold text-sm text-[#0F172A] py-4 pl-6">
                      {truncateText(testimonial.name, 30)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-[#0F172A] py-4">
                      {truncateText(testimonial.designation, 30)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-[#64748B] py-4">
                      {truncateText(testimonial.company, 30)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-[#64748B] py-4">
                      {truncateText(testimonial.feedback, 80)}
                    </TableCell>
                    <TableCell className="py-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                        testimonial.isActive 
                          ? "bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20" 
                          : "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]"
                      )}>
                        {testimonial.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-[#64748B] py-4">
                      {new Date(testimonial.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManageTestimonials && (
                      <TableCell className="text-right py-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(testimonial)}
                            className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(testimonial)}
                            className="h-8 w-8 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-xs font-semibold text-[#64748B]">
              Showing {startIndex + 1} to{' '}
              {Math.min(endIndex, filteredTestimonials.length)} of{' '}
              {filteredTestimonials.length} testimonials
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from(
                  { length: Math.min(totalPages, 5) },
                  (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          pageNum === page
                            ? "bg-[#16A34A] text-white border border-[#16A34A] rounded-xl font-bold text-xs px-3 py-1.5 h-8 min-w-[32px] transition-all duration-300 ease-in-out cursor-default"
                            : "bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 h-8 min-w-[32px] transition-all duration-300 ease-in-out active:scale-[0.98]"
                        )}
                      >
                        {pageNum}
                      </Button>
                    );
                  },
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3 py-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Testimonial Form Modal (create / edit) */}
      {formMode === 'create' ? (
        <TestimonialForm
          mode="create"
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            refetch();
          }}
          useCmsEndpoint={true}
        />
      ) : selectedTestimonial ? (
        <TestimonialForm
          mode="edit"
          testimonial={selectedTestimonial}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            refetch();
          }}
          useCmsEndpoint={true}
        />
      ) : null}

      {/* Testimonial Delete Confirmation Dialog */}
      {selectedTestimonial && (
        <TestimonialDeleteDialog
          testimonial={selectedTestimonial}
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onSuccess={() => {
            setIsDeleteOpen(false);
            refetch();
          }}
          useCmsEndpoint={true}
        />
      )}
    </div>
  );
}

