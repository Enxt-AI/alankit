'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Search, Newspaper, AlertCircle } from 'lucide-react';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import { useAdminNews } from '@/hooks/use-admin-content';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ContentForm } from '@/components/admin/content-form';
import { ContentDeleteDialog } from '@/components/admin/content-delete-dialog';
import type { News } from '@/types/content';
import { cn } from '@/lib/utils';

export default function CMSNewsPage() {
  const { cmsAdmin } = useCMSAuth();
  const hasNewsPermission = cmsAdmin?.permissions?.includes('cms_news') || cmsAdmin?.role === 'SUPER_ADMIN';

  // Early return if no permission
  if (!hasNewsPermission) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CMS: News Management</h1>
            <p className="text-muted-foreground">
              Publish and manage news articles in the CMS
            </p>
          </div>
        </div>

        <Alert>
          <AlertDescription>
            You do not have permission to access news management. Contact your administrator to enable <code className="bg-muted px-1 py-0.5 rounded text-xs">cms_news</code> permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Now call hook after return - safe
  const { data: news = [], isLoading, error, refetch } = useAdminNews(true, true); // Force enabled: true since we checked

  // Permission check
  const canManageNews =
    cmsAdmin?.permissions?.includes('cms_news') ||
    cmsAdmin?.role === 'SUPER_ADMIN' ||
    false;

  const hasNoPermission = !hasNewsPermission;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedNews, setSelectedNews] = useState<News | undefined>();

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter news by search query (title and content)
  const filteredNews = news.filter((item) => {
    const query = debounced.toLowerCase();
    const title = item.title.toLowerCase();
    const content = item.content.toLowerCase();
    return title.includes(query) || content.includes(query);
  });

  // Paginate news
  const totalPages = Math.max(1, Math.ceil(filteredNews.length / perPage));
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedNews = filteredNews.slice(startIndex, endIndex);

  // Clamp page when total pages changes (e.g., after deletions or filtering)
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  // Handlers for opening modals
  const handleCreate = () => {
    setFormMode('create');
    setSelectedNews(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (news: News) => {
    setFormMode('edit');
    setSelectedNews(news);
    setIsFormOpen(true);
  };

  const handleDelete = (news: News) => {
    setSelectedNews(news);
    setIsDeleteOpen(true);
  };

  // Helper to truncate text
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
            CMS: News Management
          </h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Publish and manage news articles in the CMS
          </p>
        </div>
      </div>

      {hasNoPermission && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm font-medium text-red-800">
            You do not have permission to manage news. Contact your administrator.
          </AlertDescription>
        </Alert>
      )}

      {!hasNoPermission && (
        <>
          {/* Search and Create Button */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                placeholder="Search news articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300"
              />
            </div>
            {canManageNews && (
              <Button 
                onClick={handleCreate}
                className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create News
              </Button>
            )}
          </div>

          {/* Loading State */}
          {isLoading && <AdminTableSkeleton rows={5} columns={6} showActions={canManageNews} />}

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="flex items-center justify-between text-red-800">
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
          {!isLoading && !error && filteredNews.length === 0 && (
            <div 
              className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center"
              style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
            >
              <Newspaper className="mb-3 h-8 w-8 text-[#64748B]" />
              <h3 className="text-sm font-semibold text-[#0F172A]">No News Articles Found</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
                {searchQuery ? 'Try adjusting your search query.' : 'Create your first news article to get started.'}
              </p>
              {canManageNews && !searchQuery && (
                <Button 
                  onClick={handleCreate}
                  className="mt-4 h-9 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] rounded-xl font-semibold text-xs px-3.5 py-1.5 transition-all duration-300 ease-in-out flex items-center gap-1.5"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create News Article
                </Button>
              )}
            </div>
          )}

          {/* News Table */}
          {!isLoading && !error && filteredNews.length > 0 && (
            <>
              <div className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
                <Table>
                  <TableHeader className="bg-[#FAFBFC]">
                    <TableRow className="hover:bg-transparent border-b border-neutral-100">
                      <TableHead className="w-[250px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 pl-6">Title</TableHead>
                      <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Category</TableHead>
                      <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Content</TableHead>
                      <TableHead className="w-[80px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Image</TableHead>
                      <TableHead className="w-[100px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Status</TableHead>
                      <TableHead className="w-[120px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5">Created</TableHead>
                      {canManageNews && <TableHead className="w-[100px] uppercase tracking-wider text-xs font-bold text-[#64748B] py-3.5 text-right pr-6">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedNews.map((item) => (
                      <TableRow key={item.id} className="hover:bg-[#F8FAFC] transition-colors border-b border-neutral-100/60">
                        <TableCell className="font-semibold text-sm text-[#0F172A] py-4 pl-6">{truncateText(item.title, 50)}</TableCell>
                        <TableCell className="py-4">
                          {item.category ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-neutral-50 text-[#64748B] border-neutral-200/60">{item.category}</span>
                          ) : (
                            <span className="text-[#64748B] text-xs font-semibold">No category</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-[#64748B] py-4">
                          {truncateText(item.content, 100)}
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                            item.imageUrl 
                              ? "bg-[#EFF6FF] text-[#2563EB] border-[#3B82F6]/20" 
                              : "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]"
                          )}>
                            {item.imageUrl ? "Yes" : "No"}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                            item.isActive 
                              ? "bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20" 
                              : "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]"
                          )}>
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-[#64748B] py-4">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </TableCell>
                        {canManageNews && (
                          <TableCell className="text-right py-4 pr-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(item)}
                                className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(item)}
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
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredNews.length)} of {filteredNews.length} news articles
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

          {/* Content Form Dialog */}
          {formMode === 'create' ? (
            <ContentForm
              mode="create"
              contentType="news"
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onSuccess={() => {
                setIsFormOpen(false);
                setSelectedNews(undefined);
                refetch();
              }}
              useCmsEndpoint={true}
            />
          ) : selectedNews ? (
            <ContentForm
              mode="edit"
              contentType="news"
              content={selectedNews}
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onSuccess={() => {
                setIsFormOpen(false);
                setSelectedNews(undefined);
                refetch();
              }}
              useCmsEndpoint={true}
            />
          ) : null}

          {/* Content Delete Dialog */}
          {selectedNews && (
            <ContentDeleteDialog
              contentType="news"
              content={selectedNews}
              isOpen={isDeleteOpen}
              onClose={() => setIsDeleteOpen(false)}
              onSuccess={() => {
                setIsDeleteOpen(false);
                setSelectedNews(undefined);
                refetch();
              }}
              useCmsEndpoint={true}
            />
          )}
        </>
      )}
    </div>
  );
}