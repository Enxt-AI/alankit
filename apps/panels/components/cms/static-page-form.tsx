'use client';

/**
 * Static Page Form Component
 *
 * Reusable form for creating and editing static pages (About Us, Contact, Terms, etc.)
 * Supports dual-mode operation (create/edit) with dynamic validation and API calls
 *
 * Usage:
 * ```tsx
 * // Create mode
 * <StaticPageForm
 *   mode="create"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => console.log('Created!')}
 * />
 *
 * // Edit mode
 * <StaticPageForm
 *   mode="edit"
 *   page={selectedPage}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => console.log('Updated!')}
 * />
 * ```
 */

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ImageUpload } from '@/components/ui/image-upload';
import { VersionHistoryDialog } from '@/components/admin/version-history-dialog';
import { RollbackConfirmationDialog } from '@/components/admin/rollback-confirmation-dialog';
import {
  createStaticPageSchema,
  updateStaticPageSchema,
  STATIC_PAGE_OPTIONS,
  PERFORMANCE_METRICS_SLUG,
  type CreateStaticPageFormValues,
  type UpdateStaticPageFormValues,
} from '@/lib/validations/static-page-schema';
import {
  useCreateStaticPage,
  useUpdateStaticPage,
  useStaticPages,
} from '@/hooks/use-static-pages';
import { useRollbackVersion } from '@/hooks/use-versions';
import { getStaticPageBySlugCms, getStaticPageBySlugAdmin } from '@/lib/static-pages-api';
import type { StaticPage } from '@/types/content';
import { cn } from '@/lib/utils';


function decodeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

// Mode-specific form value type
type StaticPageFormValues<M extends 'create' | 'edit'> = M extends 'create'
  ? CreateStaticPageFormValues
  : UpdateStaticPageFormValues;

interface BaseStaticPageFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
  slug?: string;
}

type CreateModeProps = BaseStaticPageFormProps & {
  mode: 'create';
  page?: never;
};

type EditModeProps = BaseStaticPageFormProps & {
  mode: 'edit';
  page?: StaticPage;
};

type StaticPageFormProps = CreateModeProps | EditModeProps;

export function StaticPageForm({
  mode,
  page,
  slug,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: StaticPageFormProps) {
  // State for version history dialog
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);

  // Use the rollback hook
  const rollbackMutation = useRollbackVersion(useCmsEndpoint);

  // Fetch page data if slug is provided for edit mode
  const {
    data: fetchedPage,
    isLoading: isFetchingPage,
    error: fetchError
  } = useQuery<StaticPage, Error>({
    queryKey: ['static-page', slug],
    queryFn: async () => {
      try {
        const result = useCmsEndpoint ? await getStaticPageBySlugCms(slug!) : await getStaticPageBySlugAdmin(slug!);
        return result;
      } catch (error) {
        console.error(`Failed to fetch page data for slug ${slug}:`, error);
        throw error;
      }
    },
    enabled: !!slug && mode === 'edit',
    retry: 1,
  });

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Use fetched page or provided page
  const currentPage = fetchedPage || page;

  // Fetch existing static pages in create mode to disable already-used slugs
  const { data: existingPages = [] } = useStaticPages(
    mode === 'create' && isOpen,
    useCmsEndpoint,
  );
  const existingSlugs = new Set(existingPages.map((p) => p.slug));

  // Initialize mutations
  const createMutation = useCreateStaticPage(useCmsEndpoint);
  const updateMutation = useUpdateStaticPage(useCmsEndpoint);

  // Initialize form with appropriate schema and default values
  const form = useForm<StaticPageFormValues<typeof mode>>({
    resolver: zodResolver((mode === 'create' ? createStaticPageSchema : updateStaticPageSchema) as any),
    defaultValues: {
      slug: '',
      title: '',
      content: '',
      metaTitle: '',
      metaDescription: '',
      isActive: true,
    },
  });



  // Watch the slug field to conditionally show performance metrics section
  const watchedSlug = form.watch('slug');

  /** Whether the current slug selection should show performance metrics fields */
  const showPerformanceMetrics = watchedSlug === PERFORMANCE_METRICS_SLUG;

  // Local state for About Us custom visual configuration
  const [aboutUsConfig, setAboutUsConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'story' | 'hero' | 'features' | 'leadership'>('story');

  // Helper function to update config state and sync with react-hook-form
  const updateAboutUsConfig = (updated: any) => {
    setAboutUsConfig(updated);
    form.setValue('content', JSON.stringify(updated));
  };

  // Pre-fill form when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && currentPage) {
        let isJson = false;
        let parsedConfig: any = null;
        if (currentPage.slug === PERFORMANCE_METRICS_SLUG && currentPage.content) {
          try {
            parsedConfig = JSON.parse(currentPage.content.trim());
            isJson = true;
          } catch {
            try {
              const decoded = decodeHtml(currentPage.content).trim();
              const firstCurly = decoded.indexOf('{');
              const lastCurly = decoded.lastIndexOf('}');
              if (firstCurly !== -1 && lastCurly !== -1 && firstCurly < lastCurly) {
                const jsonCandidate = decoded.substring(firstCurly, lastCurly + 1);
                parsedConfig = JSON.parse(jsonCandidate);
                isJson = true;
              }
            } catch (e) {
              console.error("Error parsing about-us content JSON:", e);
            }
          }
        }

        const initialConfig = parsedConfig || (currentPage?.content ? { ourStory_html: currentPage.content } : {});

        if (currentPage.slug === PERFORMANCE_METRICS_SLUG) {
          setAboutUsConfig(initialConfig);
        } else {
          setAboutUsConfig(null);
        }

        form.reset({
          slug: currentPage.slug,
          title: currentPage.title,
          content: isJson ? JSON.stringify(initialConfig) : (currentPage.content || ''),
          metaTitle: currentPage.metaTitle || '',
          metaDescription: currentPage.metaDescription || '',
          isActive: currentPage.isActive,
        });
      } else if (mode === 'create') {
        setAboutUsConfig(null);
        form.reset({
          slug: '',
          title: '',
          content: '',
          metaTitle: '',
          metaDescription: '',
          isActive: true,
        });
      }
    }
  }, [isOpen, mode, currentPage, form]);

  // If in create mode and user selects 'about-us' slug, initialize empty aboutUsConfig
  useEffect(() => {
    if (isOpen && showPerformanceMetrics && !aboutUsConfig) {
      setAboutUsConfig({});
    }
  }, [isOpen, showPerformanceMetrics, aboutUsConfig]);

  // Handle form submission
  const onSubmit = async (values: StaticPageFormValues<typeof mode>) => {
    try {
      /**
       * Clean up performanceMetrics before sending:
       * - If the page is not 'about-us', strip performanceMetrics entirely (set to null)
       * - If it is 'about-us' but no metrics added, send null
       * - Otherwise, send the array as-is
       */
      const slug = values.slug || currentPage?.slug;
      const metricsValue = null;

      // Ensure content has the latest serialized JSON if slug is 'about-us'
      let finalContent = values.content;
      if (slug === PERFORMANCE_METRICS_SLUG && aboutUsConfig) {
        finalContent = JSON.stringify(aboutUsConfig);
      }

      if (mode === 'create') {
        // Create mode - values is CreateStaticPageFormValues
        const createValues = {
          ...values,
          content: finalContent,
          performanceMetrics: null,
        } as any;
        await createMutation.mutateAsync(createValues);
      } else {
        // Edit mode - values is UpdateStaticPageFormValues (partial)
        if (!currentPage?.id) return;

        const updateValues = {
          ...values,
          content: finalContent,
          performanceMetrics: null,
        } as any;
        await updateMutation.mutateAsync({
          id: currentPage.id,
          dto: updateValues,
        });

        // Invalidate the cached page data to ensure fresh data on next edit
        if (slug) {
          queryClient.invalidateQueries({ queryKey: ['static-page', slug] });
        }
      }

      // Close dialog and call success callback
      onClose();
      onSuccess?.();
    } catch (error) {
      // Error handling is done in mutation hooks via toast
      console.error('Form submission error:', error);
    }
  };

  // Determine loading state from mutations
  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Generate dialog titles based on mode
  const dialogTitle =
    mode === 'create'
      ? 'Create New Static Page'
      : 'Edit Static Page';

  const dialogDescription =
    mode === 'create'
      ? 'Fill in the details to create a new page.'
      : 'Update the details of this page.';

  const inputClass = "h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 shadow-sm";
  const textareaClass = "border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 resize-none shadow-sm min-h-[100px]";
  const selectTriggerClass = "h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus:ring-offset-0 focus-visible:ring-0 focus-visible:border-[#16A34A] rounded-[14px] transition-all duration-300 bg-white text-gray-900 shadow-sm";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden gap-0 bg-white rounded-3xl border border-neutral-200 shadow-2xl">
          <DialogHeader className="px-6 py-6 border-b border-neutral-100 bg-[#FAFBFC]">
            <DialogTitle className="text-xl font-bold text-[#0F172A]">{dialogTitle}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-[#64748B]">{dialogDescription}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh] overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

                {/* Slug Field — Dropdown in create mode, read-only in edit mode */}
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-[#0F172A] text-sm">Page Type</FormLabel>
                      {mode === 'create' ? (
                        // Create mode: Show dropdown with predefined page options
                        <Select
                          value={field.value}
                          onValueChange={(selectedSlug) => {
                            // Set the slug value from dropdown
                            field.onChange(selectedSlug);

                            // Auto-fill the title based on the selected page type
                            const selectedOption = STATIC_PAGE_OPTIONS.find(
                              (opt) => opt.slug === selectedSlug
                            );
                            if (selectedOption) {
                              form.setValue('title', selectedOption.title);
                            }

                            if (selectedSlug === PERFORMANCE_METRICS_SLUG) {
                              setAboutUsConfig({});
                              form.setValue('content', JSON.stringify({}));
                            } else {
                              setAboutUsConfig(null);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className={selectTriggerClass}>
                              <SelectValue placeholder="Select a page type..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border border-neutral-200 bg-white">
                            {STATIC_PAGE_OPTIONS.map((option) => {
                              const alreadyExists = existingSlugs.has(option.slug);
                              return (
                                <SelectItem
                                  key={option.slug}
                                  value={option.slug}
                                  disabled={alreadyExists}
                                  className="hover:bg-[#F8FAFC]"
                                >
                                  {option.title}
                                  {alreadyExists && ' (already exists)'}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        // Edit mode: Show slug as read-only text (slug is immutable)
                        <FormControl>
                          <Input
                            value={field.value}
                            className={inputClass}
                            disabled
                          />
                        </FormControl>
                      )}
                      <FormDescription className="text-xs text-[#64748B]">
                        {mode === 'create'
                          ? 'Select the type of page to create. This determines the URL slug.'
                          : 'Page type cannot be changed after creation.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Title Field */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-[#0F172A] text-sm">Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., About Us, Contact Us"
                          className={inputClass}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Content Field — Tabbed Configurator for About Us, Rich Text Editor for others */}
                {showPerformanceMetrics && aboutUsConfig ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-[#0F172A] text-sm mb-1">About Us Page Configurator</h3>
                      <p className="text-xs text-[#64748B]">Edit each section of the About Us page below. Changes are saved when you click Update.</p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex flex-wrap gap-1.5 p-1 bg-[#F1F5F9] rounded-xl">
                      {([
                        { key: 'story', label: 'Our Story' },
                        { key: 'hero', label: 'Hero Banner' },
                        { key: 'features', label: 'Why Choose Us' },
                        { key: 'leadership', label: 'Leadership' },
                      ] as const).map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                            activeTab === tab.key
                              ? "bg-white text-[#0F172A] shadow-sm"
                              : "text-[#64748B] hover:text-[#0F172A] hover:bg-white/50"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* ─── TAB: Our Story ─── */}
                    {activeTab === 'story' && (
                      <div className="space-y-4 rounded-[20px] border border-neutral-200/40 p-5 bg-[#FAFBFC] shadow-sm">
                        <h4 className="font-bold text-sm text-[#0F172A]">Our Story Section</h4>
                        <div>
                          <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Badge Text</label>
                          <Input
                            className={inputClass}
                            value={aboutUsConfig.ourStory_badge ?? ''}
                            onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, ourStory_badge: e.target.value })}
                            placeholder="e.g., Our Story"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Story Content (HTML)</label>
                          <Controller
                            name="content"
                            control={form.control}
                            render={() => (
                              <RichTextEditor
                                value={aboutUsConfig.ourStory_html ?? ''}
                                onChange={(val) => updateAboutUsConfig({ ...aboutUsConfig, ourStory_html: val })}
                                placeholder="Write the 'Our Story' section content..."
                              />
                            )}
                          />
                          <p className="text-[10px] text-[#94A3B8] mt-1">This content appears in the &quot;Our Story&quot; section with styled typography.</p>
                        </div>
                      </div>
                    )}

                    {/* ─── TAB: Hero Banner ─── */}
                    {activeTab === 'hero' && (
                      <div className="space-y-4 rounded-[20px] border border-neutral-200/40 p-5 bg-[#FAFBFC] shadow-sm">
                        <h4 className="font-bold text-sm text-[#0F172A]">Hero Banner</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Badge Text</label>
                            <Input className={inputClass} value={aboutUsConfig.hero_badge ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_badge: e.target.value })} placeholder="e.g., About Us" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Hero Image</label>
                            <ImageUpload
                              value={aboutUsConfig.hero_imageUrl || ''}
                              onChange={(url) => updateAboutUsConfig({ ...aboutUsConfig, hero_imageUrl: url })}
                              bucketName="static-pages"
                              pathPrefix="hero"
                              useCmsEndpoint={useCmsEndpoint}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Title (supports HTML)</label>
                          <Textarea className={textareaClass} value={aboutUsConfig.hero_title ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_title: e.target.value })} placeholder="Main heading..." rows={2} />
                          <p className="text-[10px] text-[#94A3B8] mt-1">You can use HTML like &lt;span&gt; and &lt;br /&gt; for styling.</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Subtitle</label>
                          <Textarea className={textareaClass} value={aboutUsConfig.hero_subtitle ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_subtitle: e.target.value })} placeholder="Short description..." rows={2} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Primary Button Text</label>
                            <Input className={inputClass} value={aboutUsConfig.hero_ctaText ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_ctaText: e.target.value })} placeholder="Explore Stocks" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Primary Button Link</label>
                            <Input className={inputClass} value={aboutUsConfig.hero_ctaLink ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_ctaLink: e.target.value })} placeholder="/stocks" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Secondary Button Text</label>
                            <Input className={inputClass} value={aboutUsConfig.hero_secondaryCtaText ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_secondaryCtaText: e.target.value })} placeholder="Talk to an Expert" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Secondary Button Link</label>
                            <Input className={inputClass} value={aboutUsConfig.hero_secondaryCtaLink ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_secondaryCtaLink: e.target.value })} placeholder="tel:+91..." />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Floating Badge 1</label>
                            <Input className={inputClass} value={aboutUsConfig.hero_badge1 ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_badge1: e.target.value })} placeholder="Invest in tomorrow's leaders, today." />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Floating Badge 2</label>
                            <Input className={inputClass} value={aboutUsConfig.hero_badge2 ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, hero_badge2: e.target.value })} placeholder="Pre-IPO Opportunities" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─── TAB: Features & Steps ─── */}
                    {activeTab === 'features' && (
                      <div className="space-y-6 rounded-[20px] border border-neutral-200/40 p-5 bg-[#FAFBFC] shadow-sm">
                        {/* Why Choose Us */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-sm text-[#0F172A]">Why Choose Us</h4>
                          <div>
                            <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Section Title</label>
                            <Input className={inputClass} value={aboutUsConfig.whyChooseUs_title ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, whyChooseUs_title: e.target.value })} />
                          </div>
                          {(aboutUsConfig.whyChooseUs_features ?? []).map((f: any, i: number) => (
                            <div key={i} className="grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-start bg-white p-3 rounded-xl border border-neutral-100">
                              <div>
                                <label className="text-[10px] font-semibold text-[#64748B]">Icon</label>
                                <Input className="h-8 text-xs border-neutral-200 rounded-lg" value={f.icon ?? ''} onChange={(e) => { const arr = [...(aboutUsConfig.whyChooseUs_features ?? [])]; arr[i] = { ...arr[i], icon: e.target.value }; updateAboutUsConfig({ ...aboutUsConfig, whyChooseUs_features: arr }); }} placeholder="Icon" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#64748B]">Title</label>
                                <Input className="h-8 text-xs border-neutral-200 rounded-lg" value={f.title ?? ''} onChange={(e) => { const arr = [...(aboutUsConfig.whyChooseUs_features ?? [])]; arr[i] = { ...arr[i], title: e.target.value }; updateAboutUsConfig({ ...aboutUsConfig, whyChooseUs_features: arr }); }} />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#64748B]">Description</label>
                                <Input className="h-8 text-xs border-neutral-200 rounded-lg" value={f.desc ?? ''} onChange={(e) => { const arr = [...(aboutUsConfig.whyChooseUs_features ?? [])]; arr[i] = { ...arr[i], desc: e.target.value }; updateAboutUsConfig({ ...aboutUsConfig, whyChooseUs_features: arr }); }} />
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 rounded-lg mt-4" onClick={() => { const arr = [...(aboutUsConfig.whyChooseUs_features ?? [])]; arr.splice(i, 1); updateAboutUsConfig({ ...aboutUsConfig, whyChooseUs_features: arr }); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" className="h-8 px-3 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs" onClick={() => { const arr = [...(aboutUsConfig.whyChooseUs_features ?? []), { icon: '', title: '', desc: '' }]; updateAboutUsConfig({ ...aboutUsConfig, whyChooseUs_features: arr }); }}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Feature
                          </Button>
                        </div>


                      </div>
                    )}

                    {/* ─── TAB: Leadership ─── */}
                    {activeTab === 'leadership' && (
                      <div className="space-y-4 rounded-[20px] border border-neutral-200/40 p-5 bg-[#FAFBFC] shadow-sm">
                        <h4 className="font-bold text-sm text-[#0F172A]">Leadership Section</h4>
                        <div>
                          <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Section Title</label>
                          <Input className={inputClass} value={aboutUsConfig.leadership_title ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, leadership_title: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-[#0F172A] mb-1 block">Section Description</label>
                          <Textarea className={textareaClass} value={aboutUsConfig.leadership_desc ?? ''} onChange={(e) => updateAboutUsConfig({ ...aboutUsConfig, leadership_desc: e.target.value })} rows={2} />
                        </div>

                        <p className="text-xs font-semibold text-[#0F172A]">Team Members ({(aboutUsConfig.leadership_members ?? []).length})</p>
                        {(aboutUsConfig.leadership_members ?? []).map((m: any, i: number) => (
                          <div key={i} className="bg-white p-4 rounded-xl border border-neutral-100 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#64748B]">Member {i + 1}</span>
                                {m.name && <span className="text-xs font-semibold text-[#0F172A]">· {m.name}</span>}
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50 hover:text-red-600 rounded-lg" onClick={() => { const arr = [...(aboutUsConfig.leadership_members ?? [])]; arr.splice(i, 1); updateAboutUsConfig({ ...aboutUsConfig, leadership_members: arr }); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Member Photo */}
                            <div>
                              <label className="text-[10px] font-semibold text-[#64748B] mb-1 block">Member Photo</label>
                              <ImageUpload
                                value={m.imageUrl || ''}
                                onChange={(url) => {
                                  const arr = [...(aboutUsConfig.leadership_members ?? [])];
                                  arr[i] = { ...arr[i], imageUrl: url };
                                  updateAboutUsConfig({ ...aboutUsConfig, leadership_members: arr });
                                }}
                                bucketName="static-pages"
                                pathPrefix="leadership"
                                useCmsEndpoint={useCmsEndpoint}
                                label="Photo"
                                compact={true}
                                objectFit="cover"
                              />
                            </div>

                            <div className="grid grid-cols-[60px_1fr_1fr] gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-[#64748B]">Initials</label>
                                <Input className="h-8 text-xs border-neutral-200 rounded-lg" value={m.initials ?? ''} onChange={(e) => { const arr = [...(aboutUsConfig.leadership_members ?? [])]; arr[i] = { ...arr[i], initials: e.target.value }; updateAboutUsConfig({ ...aboutUsConfig, leadership_members: arr }); }} placeholder="DA" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#64748B]">Full Name</label>
                                <Input className="h-8 text-xs border-neutral-200 rounded-lg" value={m.name ?? ''} onChange={(e) => { const arr = [...(aboutUsConfig.leadership_members ?? [])]; arr[i] = { ...arr[i], name: e.target.value }; updateAboutUsConfig({ ...aboutUsConfig, leadership_members: arr }); }} placeholder="Dr. D.K. Aggarwal" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-[#64748B]">Role / Designation</label>
                                <Input className="h-8 text-xs border-neutral-200 rounded-lg" value={m.role ?? ''} onChange={(e) => { const arr = [...(aboutUsConfig.leadership_members ?? [])]; arr[i] = { ...arr[i], role: e.target.value }; updateAboutUsConfig({ ...aboutUsConfig, leadership_members: arr }); }} placeholder="Chairman & MD" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-[#64748B]">Bio / Description</label>
                              <Textarea className="text-xs border-neutral-200 rounded-lg min-h-[60px] resize-none" value={m.desc ?? ''} onChange={(e) => { const arr = [...(aboutUsConfig.leadership_members ?? [])]; arr[i] = { ...arr[i], desc: e.target.value }; updateAboutUsConfig({ ...aboutUsConfig, leadership_members: arr }); }} rows={2} />
                            </div>
                          </div>
                        ))}
                        <Button type="button" className="h-8 px-3 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs" onClick={() => { const arr = [...(aboutUsConfig.leadership_members ?? []), { imageUrl: '', initials: '', name: '', role: '', desc: '' }]; updateAboutUsConfig({ ...aboutUsConfig, leadership_members: arr }); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
                        </Button>
                      </div>
                    )}

                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-[#0F172A] text-sm">Content</FormLabel>
                        <FormControl>
                          <Controller
                            name="content"
                            control={form.control}
                            render={({ field: controllerField }) => (
                              <RichTextEditor
                                value={controllerField.value || ''}
                                onChange={controllerField.onChange}
                                placeholder="Start writing your page content..."
                              />
                            )}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-[#64748B]">
                          Use the rich text editor below to format your page content with headings, lists, bold/italic text, and links.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}



                {/* Meta Title Field */}
                <FormField
                  control={form.control}
                  name="metaTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-[#0F172A] text-sm">Meta Title (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SEO title (max 60 chars)"
                          className={inputClass}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-[#64748B]">
                        Optional: Overrides title for search engines
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Meta Description Field */}
                <FormField
                  control={form.control}
                  name="metaDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-[#0F172A] text-sm">Meta Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="SEO description (max 160 chars)"
                          className={textareaClass}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-[#64748B]">
                        Optional: Appears in search results
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Active Status Field */}
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-[20px] border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-[#16A34A]/40 hover:shadow-md cursor-pointer group" onClick={() => field.onChange(!field.value)}>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-[#16A34A] data-[state=checked]:border-[#16A34A] scale-110"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none cursor-pointer pointer-events-none">
                        <FormLabel className="font-semibold text-sm text-[#0F172A]">Active Visibility</FormLabel>
                        <FormDescription className="text-[11px] text-[#64748B] leading-tight">
                          Inactive pages are hidden from users
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="px-6 py-4 border-t border-neutral-100 bg-[#FAFBFC] shrink-0">
                <div className="flex w-full justify-between items-center sm:flex-row flex-col gap-4 sm:gap-0">
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-start">
                    {mode === 'edit' && currentPage?.id && useCmsEndpoint && (
                      <Button
                        type="button"
                        className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] w-full sm:w-auto"
                        onClick={() => setShowVersionHistory(true)}
                      >
                        View History
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                    <Button
                      type="button"
                      onClick={onClose}
                      disabled={isLoading}
                      className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-6 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="h-10 px-6 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm transition-all duration-300 ease-in-out flex items-center justify-center gap-2 outline-none disabled:opacity-50 disabled:pointer-events-none w-full sm:w-auto"
                    >
                      {isLoading ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog - Only for CMS mode */}
      {mode === 'edit' && currentPage?.id && useCmsEndpoint && (
        <>
          <VersionHistoryDialog
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            entityType="STATIC_PAGE"
            entityId={currentPage.id}
            entityName={currentPage.title}
            onRollback={(versionNumber) => setRollbackVersion(versionNumber)}
            useCmsEndpoint={useCmsEndpoint}
          />

          <RollbackConfirmationDialog
            isOpen={rollbackVersion !== null}
            onClose={() => setRollbackVersion(null)}
            versionNumber={rollbackVersion!}
            isLoading={rollbackMutation.isPending}
            onConfirm={async () => {
              await rollbackMutation.mutateAsync({
                entityType: 'STATIC_PAGE',
                entityId: currentPage.id,
                versionNumber: rollbackVersion!
              });
              setRollbackVersion(null);
              setShowVersionHistory(false);
              onClose();
              onSuccess?.();
            }}
            entityName={currentPage.title}
          />
        </>
      )}
    </>
  );
}