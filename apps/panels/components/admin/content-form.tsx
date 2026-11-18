"use client";

/**
 * Content Form Component
 *
 * Reusable form for creating and editing news articles and article posts
 * Supports dual-mode operation (create/edit) with dynamic API calls based on contentType
 *
 * Usage:
 * ```tsx
 * // Create mode
 * <ContentForm
 *   mode="create"
 *   contentType="news"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => console.log('Created!')}
 * />
 *
 * // Edit mode
 * <ContentForm
 *   mode="edit"
 *   contentType="article"
 *   content={selectedArticle}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => console.log('Updated!')}
 * />
 * ```
 */

import { useEffect } from "react";
import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import { RollbackConfirmationDialog } from "@/components/admin/rollback-confirmation-dialog";
import {
  createContentSchema,
  updateContentSchema,
  type CreateContentFormValues,
  type UpdateContentFormValues,
} from "@/lib/validations/content-schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateNews,
  useUpdateNews,
  useCreateArticle,
  useUpdateArticle,
  useDeleteNews,
  useDeleteArticle,
} from "@/hooks/use-admin-content";
import { useRollbackVersion } from "@/hooks/use-versions";
import { useNewsCategories, useArticleCategories } from "@/hooks/use-content";
import { useAdminStocks } from "@/hooks/use-admin-stocks";
import { Search, Loader2, Plus, Trash2 } from "lucide-react";
import type { News, Article } from "@/types/content";
import { getStorageUrl } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Mode-specific form value type
type ContentFormValues<M extends "create" | "edit"> = M extends "create"
  ? CreateContentFormValues
  : UpdateContentFormValues;

interface BaseContentFormProps {
  contentType: "news" | "article";
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
}

type CreateModeProps = BaseContentFormProps & {
  mode: "create";
  content?: never;
};

type EditModeProps = BaseContentFormProps & {
  mode: "edit";
  content: News | Article;
};

type ContentFormProps = CreateModeProps | EditModeProps;

interface ContentDeleteDialogProps {
  contentType: "news" | "article";
  content: News | Article;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  useCmsEndpoint?: boolean;
}

export function ContentForm({
  mode,
  contentType,
  content,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: ContentFormProps) {
  // State for version history dialog
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [rollbackVersion, setRollbackVersion] = React.useState<number | null>(
    null,
  );
  const [showDeleteConfirmation, setShowDeleteConfirmation] =
    React.useState(false);

  // Use the rollback hook
  const rollbackMutation = useRollbackVersion(useCmsEndpoint);
  const createNewsMutation = useCreateNews(useCmsEndpoint);
  const updateNewsMutation = useUpdateNews(useCmsEndpoint);

  // Get mutation hooks for articles
  const createArticleMutation = useCreateArticle(useCmsEndpoint);
  const updateArticleMutation = useUpdateArticle(useCmsEndpoint);

  // Get delete mutation hooks
  const deleteNewsMutation = useDeleteNews(useCmsEndpoint);
  const deleteArticleMutation = useDeleteArticle(useCmsEndpoint);

  // Categories fetching
  const { data: newsCategories } = useNewsCategories();
  const { data: articleCategories } = useArticleCategories();
  const categories = contentType === "news" ? newsCategories : articleCategories;

  // Fetch stocks for association
  const { data: stocks, isLoading: isLoadingStocks } = useAdminStocks(isOpen, true);

  // Select schema and type based on mode
  const schema = mode === "create" ? createContentSchema : updateContentSchema;

  // Initialize form with React Hook Form using mode-specific generic type
  // TypeScript will infer the correct type based on mode at compile time
  const form = useForm<ContentFormValues<typeof mode>>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      title: "",
      content: "",
      imageUrl: "",
      category: "",
      isActive: true,
      stockId: "",
      slug: "",
      summary: "",
      keyFacts: [],
      authorName: "",
      authorRole: "",
      authorBio: "",
      reviewedBy: "",
      contentReviewedAt: "",
      faqs: [],
    },
  });

  // Article-only repeatable blocks. News never renders these fields, so the
  // arrays simply stay empty for news.
  const keyFactsArray = useFieldArray({
    control: form.control as any,
    name: "keyFacts",
  });
  const faqsArray = useFieldArray({
    control: form.control as any,
    name: "faqs",
  });

  // Reset form when dialog opens/closes or content changes
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && content) {
        const article = content as Article;
        // Pre-fill form in edit mode with all fields from content
        form.reset({
          title: content.title,
          content: content.content,
          imageUrl: getStorageUrl(content.imageUrl),
          category: content.category || "",
          isActive: content.isActive,
          stockId: (content as any).stockId || "",
          slug: article.slug || "",
          summary: article.summary || "",
          keyFacts: (article.keyFacts || []).map((f) => ({
            label: f.label,
            value: f.value,
          })),
          authorName: article.authorName || "",
          authorRole: article.authorRole || "",
          authorBio: article.authorBio || "",
          reviewedBy: article.reviewedBy || "",
          contentReviewedAt: article.contentReviewedAt
            ? article.contentReviewedAt.slice(0, 10)
            : "",
          faqs: (article.faqs || []).map((f) => ({
            question: f.question,
            answer: f.answer,
          })),
        } as ContentFormValues<typeof mode>);
      } else {
        // Reset to empty in create mode with required fields
        form.reset({
          title: "",
          content: "",
          imageUrl: "",
          category: "",
          isActive: true,
          stockId: "",
          slug: "",
          summary: "",
          keyFacts: [],
          authorName: "",
          authorRole: "",
          authorBio: "",
          reviewedBy: "",
          contentReviewedAt: "",
          faqs: [],
        } as ContentFormValues<typeof mode>);
      }
    }
  }, [isOpen, mode, content, form]);

  // Handle form submission with mode-specific typing
  const onSubmit = async (values: ContentFormValues<typeof mode>) => {
    try {
      const cleanStockId =
        (values as any).stockId &&
        (values as any).stockId !== '_none' &&
        (values as any).stockId.trim() !== ''
          ? (values as any).stockId.trim()
          : null;

      const normalizedValues: any = {
        ...values,
        imageUrl: values.imageUrl ? getStorageUrl(values.imageUrl) : values.imageUrl,
        stockId: cleanStockId,
      };

      if (contentType === "article") {
        // Empty optional strings must not reach the API: "" would be stored as
        // a real value, and an empty slug would break the public URL.
        for (const key of [
          "slug",
          "summary",
          "authorName",
          "authorRole",
          "authorBio",
          "reviewedBy",
          "contentReviewedAt",
        ]) {
          if (normalizedValues[key] === "") normalizedValues[key] = undefined;
        }

        normalizedValues.keyFacts = (values.keyFacts || [])
          .filter((fact) => fact?.label?.trim() && fact?.value?.trim())
          .map((fact) => ({
            label: fact.label.trim(),
            value: fact.value.trim(),
          }));

        normalizedValues.faqs = (values.faqs || [])
          .filter((faq) => faq?.question?.trim() && faq?.answer?.trim())
          .map((faq, index) => ({
            question: faq.question.trim(),
            answer: faq.answer.trim(),
            order: index,
          }));
      } else {
        // News DTOs run with forbidNonWhitelisted: article-only fields would
        // be rejected as unknown properties.
        delete normalizedValues.slug;
        delete normalizedValues.summary;
        delete normalizedValues.keyFacts;
        delete normalizedValues.authorName;
        delete normalizedValues.authorRole;
        delete normalizedValues.authorBio;
        delete normalizedValues.reviewedBy;
        delete normalizedValues.contentReviewedAt;
        delete normalizedValues.faqs;
      }

      // Conditionally call the appropriate mutation based on mode and contentType
      if (mode === "create") {
        // In create mode, values is CreateContentFormValues
        const createValues = normalizedValues as CreateContentFormValues;
        if (contentType === "news") {
          await createNewsMutation.mutateAsync(createValues);
        } else {
          await createArticleMutation.mutateAsync(createValues);
        }
      } else {
        // Edit mode - values is UpdateContentFormValues (partial)
        if (!content?.id) return;

        const updateValues = normalizedValues as UpdateContentFormValues;
        if (contentType === "news") {
          await updateNewsMutation.mutateAsync({
            id: content.id,
            dto: updateValues,
          });
        } else {
          await updateArticleMutation.mutateAsync({
            id: content.id,
            dto: updateValues,
          });
        }
      }

      // Close dialog and call success callback
      onClose();
      onSuccess?.();
    } catch (error) {
      // Error handling is done in mutation hooks via toast
      console.error("Form submission error:", error);
    }
  };

  const handleDelete = async () => {
    if (!content?.id) return;
    try {
      if (contentType === "news") {
        await deleteNewsMutation.mutateAsync(content.id);
      } else {
        await deleteArticleMutation.mutateAsync(content.id);
      }
      setShowDeleteConfirmation(false);
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  // Determine loading state from mutations
  const isLoading =
    createNewsMutation.isPending ||
    updateNewsMutation.isPending ||
    createArticleMutation.isPending ||
    updateArticleMutation.isPending ||
    deleteNewsMutation.isPending ||
    deleteArticleMutation.isPending;

  // Generate dialog titles based on mode and contentType
  const dialogTitle =
    mode === "create"
      ? contentType === "news"
        ? "Create New News Article"
        : "Create New Article Post"
      : contentType === "news"
        ? "Edit News Article"
        : "Edit Article Post";

  const dialogDescription =
    mode === "create"
      ? `Fill in the details to create a new ${contentType === "news" ? "news article" : "article post"}.`
      : `Update the details of this ${contentType === "news" ? "news article" : "article post"}.`;

  const contentTypeLabel =
    contentType === "news" ? "news article" : "article post";
  const contentTypeCapitalized = contentType === "news" ? "News" : "Article";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden gap-0 bg-white">
          <DialogHeader className="px-6 py-6 border-b bg-slate-50/50">
            <DialogTitle className="text-xl font-semibold text-slate-800">{dialogTitle}</DialogTitle>
            <DialogDescription className="mt-1.5 text-slate-500">{dialogDescription}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh] overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-emerald-500 rounded-full"></div>
                    Content Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Title Field */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel className="text-slate-700 font-medium">Title <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              placeholder="e.g., Market Update: Tech Stocks Surge"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Category Management */}
                    <div className="col-span-1 md:col-span-2 space-y-4 rounded-xl border border-slate-200/60 p-5 bg-slate-50/80 shadow-sm">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-800">
                          Category Management
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Choose an existing category or create a new one to organize this {contentTypeLabel}.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Select Existing */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Pick Existing</label>
                          <Select 
                            value={(() => {
                              const val = form.watch("category") || "";
                              return (categories?.includes(val)) ? val : (val ? "_custom" : "_none");
                            })()} 
                            onValueChange={(val) => {
                              if (val === "_none") {
                                form.setValue("category", "");
                              } else if (val !== "_custom") {
                                form.setValue("category", val);
                              }
                            }}
                          >
                            <SelectTrigger className="bg-white border-slate-200 h-10 transition-all hover:border-emerald-300 shadow-sm">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none" className="text-slate-400 italic">None / Reset</SelectItem>
                              {categories?.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                              <SelectItem value="_custom" className="text-emerald-600 font-medium">
                                {(() => {
                                  const val = form.watch("category") || "";
                                  return val && !categories?.includes(val) 
                                    ? `Custom: ${val}` 
                                    : "Type Custom...";
                                })()}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Create New Field */}
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Create New / Edit</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Type new category..."
                                  {...field}
                                  value={field.value || ""}
                                  className="bg-blue-50/30 border-blue-200 h-10 focus:bg-white transition-all shadow-sm focus-visible:ring-blue-400 ring-offset-0"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rich Media & Body Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                    Body & Media
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-5">
                    {/* Image URL Field */}
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Cover Image</FormLabel>
                          <FormControl>
                            <ImageUpload
                              value={field.value || ''}
                              onChange={field.onChange}
                              bucketName="content"
                              pathPrefix={contentType === 'news' ? 'news' : 'articles'}
                              useCmsEndpoint={useCmsEndpoint}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-slate-500">
                            Public URL to the featured image for this {contentTypeLabel}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Content Field */}
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Article Body <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Textarea
                              rows={8}
                              placeholder="Write your content here... (Supports rich text HTML output)"
                              className="shadow-sm border-slate-200 focus-visible:ring-blue-500 resize-y min-h-[150px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* SEO & Answer Engine Section (articles only) */}
                {contentType === "article" && (
                  <div className="space-y-4">
                    <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <div className="h-4 w-1 bg-violet-500 rounded-full"></div>
                      SEO &amp; Answer Engine
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Slug */}
                      <FormField
                        control={form.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">URL Slug</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11 shadow-sm border-slate-200 focus-visible:ring-violet-500 font-mono text-sm"
                                placeholder="e.g. how-to-buy-unlisted-shares-india"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-slate-500">
                              Public URL is <code>/articles/&lt;slug&gt;</code>. Leave blank to derive it from the title.
                              Changing it on a live article breaks existing links.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Reviewed date */}
                      <FormField
                        control={form.control}
                        name="contentReviewedAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">Content Reviewed On</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                className="h-11 shadow-sm border-slate-200 focus-visible:ring-violet-500"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-slate-500">
                              Drives <code>dateModified</code> in structured data. Update it only when the copy is fact-checked.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Summary */}
                      <FormField
                        control={form.control}
                        name="summary"
                        render={({ field }) => (
                          <FormItem className="col-span-1 md:col-span-2">
                            <FormLabel className="text-slate-700 font-medium">Quick Answer / Summary</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={5}
                                className="shadow-sm border-slate-200 focus-visible:ring-violet-500 resize-y"
                                placeholder="120-150 word direct answer. Quoted by AI answer engines above the article body."
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-slate-500">
                              This is rendered above the body. Do <strong>not</strong> repeat it inside the Article Body —
                              otherwise readers see the same answer twice and the two copies can drift apart.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Key facts */}
                    <div className="rounded-xl border border-slate-200/60 p-5 bg-slate-50/80 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-800">Key Facts</label>
                          <p className="text-[11px] text-slate-500">
                            Label/value rows shown as a table. Keep values short and factual.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => keyFactsArray.append({ label: "", value: "" })}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add fact
                        </Button>
                      </div>

                      {keyFactsArray.fields.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No key facts yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {keyFactsArray.fields.map((row, index) => (
                            <div
                              key={row.id}
                              className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-3 items-start"
                            >
                              <FormField
                                control={form.control}
                                name={`keyFacts.${index}.label` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        className="bg-white shadow-sm border-slate-200"
                                        placeholder="Label (e.g. Settlement)"
                                        {...field}
                                        value={field.value || ""}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`keyFacts.${index}.value` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        className="bg-white shadow-sm border-slate-200"
                                        placeholder="Value (e.g. T+1 for delivery)"
                                        {...field}
                                        value={field.value || ""}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => keyFactsArray.remove(index)}
                                aria-label="Remove key fact"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Author / reviewer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField
                        control={form.control}
                        name="authorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">Author Name</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11 shadow-sm border-slate-200 focus-visible:ring-violet-500"
                                placeholder="e.g. Saurabh Sharma"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="authorRole"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">Author Role</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11 shadow-sm border-slate-200 focus-visible:ring-violet-500"
                                placeholder="e.g. Research Analyst"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="authorBio"
                        render={({ field }) => (
                          <FormItem className="col-span-1 md:col-span-2">
                            <FormLabel className="text-slate-700 font-medium">Author Bio</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                className="shadow-sm border-slate-200 focus-visible:ring-violet-500 resize-y"
                                placeholder="One or two sentences establishing expertise (E-E-A-T)."
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reviewedBy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">Reviewed By</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11 shadow-sm border-slate-200 focus-visible:ring-violet-500"
                                placeholder="e.g. Compliance Desk"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* FAQs */}
                    <div className="rounded-xl border border-slate-200/60 p-5 bg-slate-50/80 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-800">Article FAQs</label>
                          <p className="text-[11px] text-slate-500">
                            Rendered below the body and emitted as FAQPage structured data. Do not repeat these inside the
                            Article Body.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() =>
                            faqsArray.append({ question: "", answer: "" })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Add FAQ
                        </Button>
                      </div>

                      {faqsArray.fields.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No FAQs yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {faqsArray.fields.map((row, index) => (
                            <div
                              key={row.id}
                              className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                  FAQ {index + 1}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => faqsArray.remove(index)}
                                  aria-label="Remove FAQ"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormField
                                control={form.control}
                                name={`faqs.${index}.question` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        className="shadow-sm border-slate-200"
                                        placeholder="Question"
                                        {...field}
                                        value={field.value || ""}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`faqs.${index}.answer` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Textarea
                                        rows={3}
                                        className="shadow-sm border-slate-200 resize-y"
                                        placeholder="Answer"
                                        {...field}
                                        value={field.value || ""}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Platform Linking & Visibility Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-amber-500 rounded-full"></div>
                    Linking & Visibility
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Stock Association */}
                    <FormField
                      control={form.control}
                      name="stockId"
                      render={({ field }) => (
                        <FormItem className="space-y-3 bg-slate-50/50 p-5 rounded-xl border border-slate-200/60 transition-all hover:bg-slate-50">
                          <div className="flex flex-col mb-1">
                            <FormLabel className="text-sm font-semibold text-slate-800">Associate with Stock</FormLabel>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Linking this {contentTypeLabel} to a stock will display it directly on that stock's detail page.
                            </p>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Select onValueChange={field.onChange} value={field.value || "_none"}>
                                <SelectTrigger className="bg-white border-slate-200 shadow-sm h-11 transition-all group-hover:border-amber-300 focus:ring-amber-500 text-sm">
                                  <SelectValue placeholder={isLoadingStocks ? `Loading absolute valid stocks...` : `Search and select a stock...`} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {isLoadingStocks ? (
                                    <div className="flex items-center justify-center p-6 text-slate-500 text-sm gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span>Fetching available stocks...</span>
                                    </div>
                                  ) : (
                                    <>
                                      <SelectItem value="_none" className="text-slate-400 italic">None / Clear Association</SelectItem>
                                      {stocks?.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-xs">No stocks found.</div>
                                      ) : (
                                        stocks?.map((stock) => (
                                          <SelectItem key={stock.id} value={stock.id} className="cursor-pointer py-2">
                                            <div className="flex flex-col space-y-0.5">
                                              <span className="font-semibold text-slate-800 text-sm">{stock.name}</span>
                                              <span className="text-[10px] text-slate-400 font-mono tracking-tighter">CIN: {stock.cin}</span>
                                            </div>
                                          </SelectItem>
                                        ))
                                      )}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Active Status */}
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0 p-5 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer group" onClick={() => field.onChange(!field.value)}>
                          <div className="space-y-1 pr-4">
                            <FormLabel className="font-semibold text-sm text-slate-800 cursor-pointer pointer-events-none">Active Visibility</FormLabel>
                            <p className="text-[11px] text-slate-500 leading-tight">Controls if this {contentTypeLabel} is visible to users on the platform.</p>
                          </div>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 scale-125" onClick={(e) => e.stopPropagation()} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              </div>

              {/* Action Footer */}
              <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                <div className="flex w-full justify-between items-center sm:flex-row flex-col gap-4 sm:gap-0">
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-start">
                    {mode === "edit" && content?.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium"
                        onClick={() => setShowVersionHistory(true)}
                        disabled={isLoading}
                      >
                        View History
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isLoading}
                      className="h-10 px-6 font-medium border-slate-300 text-slate-700 hover:bg-slate-100 w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shadow-sm hover:shadow-md w-full sm:w-auto"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : mode === "create" ? (
                        `Create ${contentTypeCapitalized}`
                      ) : (
                        `Update ${contentTypeCapitalized}`
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      {mode === "edit" && content?.id && (
        <>
          <VersionHistoryDialog
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            entityType={contentType === "news" ? "NEWS" : "ARTICLE"}
            entityId={content.id}
            entityName={content.title}
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
                entityType: contentType === "news" ? "NEWS" : "ARTICLE",
                entityId: content.id,
                versionNumber: rollbackVersion!,
              });
              setRollbackVersion(null);
              setShowVersionHistory(false);
              onClose();
              onSuccess?.();
            }}
            entityName={content.title}
          />
        </>
      )}
    </>
  );
}
