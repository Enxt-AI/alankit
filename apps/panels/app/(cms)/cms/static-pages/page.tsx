'use client';

/**
 * Static Pages Management Page
 *
 * Page for managing static pages (About Us, Contact, Terms, etc.)
 * Features:
 * - Permission-based access control (cms_static_pages permission)
 * - Client-side search filtering by slug/title (debounced 300ms)
 * - Client-side pagination (10 items per page)
 * - Create, edit, and delete operations
 * - Loading, error, and empty state handling
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import { useStaticPages } from '@/hooks/use-static-pages';
import { StaticPageDeleteDialog } from '@/components/cms/static-page-delete-dialog';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, Search, FileEdit, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StaticPage } from '@/types/content';

export default function StaticPagesPage() {
  const router = useRouter();
  const { cmsAdmin } = useCMSAuth();

  const hasStaticPagesPermission = cmsAdmin?.permissions?.includes('cms_static_pages') || cmsAdmin?.role === 'SUPER_ADMIN';

  // Early return if no permission
  if (!hasStaticPagesPermission) {
    return (
      <div className="space-y-6 py-2">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Static Pages Management</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Manage About Us, Contact, Terms & Conditions, and other static pages
          </p>
        </div>

        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to access static pages. Contact your administrator to enable{' '}
            <code className="bg-neutral-100 text-[#0F172A] px-2 py-1 rounded-[6px] text-xs font-mono border border-neutral-200/50">cms_static_pages</code> permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Now call hook after return - safe
  const { data: pages = [], isLoading, error, refetch } = useStaticPages(true, true); // Force enabled: true since we checked

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modal state (only for delete)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<StaticPage | undefined>();

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter pages by search query (slug and title)
  const filteredPages = pages.filter((page) => {
    const query = debouncedQuery.toLowerCase();
    const slug = page.slug.toLowerCase();
    const title = page.title.toLowerCase();
    return slug.includes(query) || title.includes(query);
  });

  // Paginate results
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / perPage));
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedPages = filteredPages.slice(startIndex, endIndex);

  // Clamp page when total pages changes (e.g., after deletions or filtering)
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  // Handlers for opening modals
  const handleCreate = () => {
    router.push('/cms/static-pages/new');
  };

  const handleEdit = (page: StaticPage) => {
    router.push(`/cms/static-pages/${page.slug}`);
  };

  const handleDelete = (page: StaticPage) => {
    setSelectedPage(page);
    setIsDeleteOpen(true);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Truncate text for display
  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Static Pages Management</h1>
        <p className="text-sm font-medium text-[#64748B] mt-1">
          Manage About Us, Contact, Terms & Conditions, and other static pages
        </p>
      </div>

      {/* Search and Create */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            placeholder="Search pages by slug or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300"
          />
        </div>
        {hasStaticPagesPermission && (
          <Button 
            onClick={handleCreate}
            className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
          >
            <Plus className="h-4 w-4" />
            Create Page
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-[24px] border border-neutral-200/40 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.03)] p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16A34A] mx-auto mb-4"></div>
          <p className="text-sm font-medium text-[#64748B]">Loading static pages...</p>
        </div>
      )}

      {/* Error State */}
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

      {/* Empty State */}
      {!isLoading && !error && filteredPages.length === 0 && (
        <div 
          className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center"
          style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
        >
          <FileEdit className="mb-3 h-8 w-8 text-[#64748B]" />
          <h3 className="text-sm font-semibold text-[#0F172A]">No Static Pages Found</h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
            {searchQuery ? 'Try adjusting your search query.' : 'Create your first page to get started.'}
          </p>
          {hasStaticPagesPermission && !searchQuery && (
            <Button 
              onClick={handleCreate}
              className="mt-4 h-9 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] rounded-xl font-semibold text-xs px-3.5 py-1.5 transition-all duration-300 ease-in-out flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Page
            </Button>
          )}
        </div>
      )}

      {/* Pages Table */}
      {!isLoading && !error && filteredPages.length > 0 && (
        <>
          <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
            <Table>
              <TableHeader className="bg-[#FAFBFC]">
                <TableRow className="hover:bg-transparent border-b border-neutral-100">
                  <TableHead className="w-[250px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 pl-6">Slug</TableHead>
                  <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Title</TableHead>
                  <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Status</TableHead>
                  <TableHead className="w-[140px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Created</TableHead>
                  {hasStaticPagesPermission && (
                    <TableHead className="w-[100px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 text-right pr-6">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPages.map((page) => (
                  <TableRow key={page.id} className="hover:bg-[#F8FAFC] transition-colors border-b border-neutral-100/60">
                    <TableCell className="font-medium py-4 pl-6">
                      <code className="bg-neutral-100 text-[#0F172A] px-2 py-1 rounded-[6px] text-xs font-mono border border-neutral-200/50">
                        {page.slug}
                      </code>
                    </TableCell>
                    <TableCell className="font-semibold text-sm text-[#0F172A] py-4">
                      <div className="max-w-[300px]">
                        {truncateText(page.title, 50)}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                        page.isActive 
                          ? "bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20" 
                          : "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]"
                      )}>
                        {page.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-[#64748B] py-4">
                      {formatDate(page.createdAt)}
                    </TableCell>
                    {hasStaticPagesPermission && (
                      <TableCell className="text-right py-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(page)}
                            className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(page)}
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

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-xs font-semibold text-[#64748B]">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredPages.length)} of {filteredPages.length} pages
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
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                })}
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

      {/* Modals */}
      {selectedPage && (
        <StaticPageDeleteDialog
          page={selectedPage}
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