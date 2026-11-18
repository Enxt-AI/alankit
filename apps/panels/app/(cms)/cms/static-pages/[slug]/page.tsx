'use client';

/**
 * Static Page Slug Edit Route
 *
 * Dynamic route for editing static pages by slug
 * Fetches page data and renders StaticPageForm in edit mode
 */

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StaticPageForm } from '@/components/cms/static-page-form';
import { getStaticPageBySlugCms } from '@/lib/static-pages-api';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import type { StaticPage } from '@/types/content';

export default function StaticPageSlugEditPage() {
  const params = useParams();
  const router = useRouter();
  const { cmsAdmin } = useCMSAuth();
  const slug = params.slug as string;
  const queryClient = useQueryClient();

  // Permission check
  const canManageStaticPages = cmsAdmin?.permissions?.includes('cms_static_pages') ?? false;

  // Fetch page data
  const {
    data: page,
    isLoading,
    error,
    refetch,
  } = useQuery<StaticPage, Error>({
    queryKey: ['static-page', slug],
    queryFn: () => getStaticPageBySlugCms(slug),
    enabled: !!slug && canManageStaticPages,
    retry: false, // Don't retry on 404
  });

  // Handle successful update.
  // Note: no popup here — the update hook already confirms the approval submission.
  const handleSuccess = () => {
    // Invalidate cached data to ensure fresh data on future edits
    queryClient.invalidateQueries({ queryKey: ['static-page', slug] });
    router.push('/cms/static-pages');
  };

  // Handle back navigation
  const handleBack = () => {
    router.push('/cms/static-pages');
  };

  // Permission check UI
  if (!canManageStaticPages) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-xl text-muted-foreground">
            You do not have permission to edit static pages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Static Pages
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Edit Static Page
          </h1>
          <p className="text-xl text-muted-foreground">
            Editing page: <code className="bg-muted px-2 py-1 rounded text-sm">{slug}</code>
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading page...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error.message}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      {page && !isLoading && !error && (
        <div className="space-y-6">
          <StaticPageForm
            mode="edit"
            page={page}
            isOpen={true}
            onClose={handleBack}
            onSuccess={handleSuccess}
            useCmsEndpoint={true}
          />
        </div>
      )}
    </div>
  );
}