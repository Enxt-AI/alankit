'use client';

/**
 * Static Page Create Route
 *
 * Route for creating new static pages
 * Renders StaticPageForm in create mode
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaticPageForm } from '@/components/cms/static-page-form';
import { useCMSAuth } from '@/hooks/use-cms-auth';

export default function StaticPageCreatePage() {
  const router = useRouter();
  const { cmsAdmin } = useCMSAuth();

  // Permission check
  const canManageStaticPages = cmsAdmin?.permissions?.includes('cms_static_pages') ?? false;

  // Handle successful creation
  const handleSuccess = () => {
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
            You do not have permission to create static pages.
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
            Create Static Page
          </h1>
          <p className="text-xl text-muted-foreground">
            Create a new static page for your website
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <StaticPageForm
          mode="create"
          isOpen={true}
          onClose={handleBack}
          onSuccess={handleSuccess}
          useCmsEndpoint={true}
        />
      </div>
    </div>
  );
}