"use client";

import { useForm } from "react-hook-form";
import { notify } from "@/components/ui/floating-notification";
import { Button } from "@/components/ui/button";
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
import { useUpsertSeoMetadata } from "@/hooks/use-seo-metadata";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SeoMetadata, UpsertSeoMetadataDto } from "@/lib/seo-metadata-api";
import { useRouter } from "next/navigation";

interface SeoMetadataFormProps {
  initialData?: SeoMetadata;
  onCancel?: () => void;
}

export function SeoMetadataForm({ initialData, onCancel }: SeoMetadataFormProps) {
  const router = useRouter();
  const upsertMutation = useUpsertSeoMetadata();

  const form = useForm<UpsertSeoMetadataDto>({
    defaultValues: {
      id: initialData?.id,
      path: initialData?.path || "",
      metaTitle: initialData?.metaTitle || "",
      metaDescription: initialData?.metaDescription || "",
      schemaMarkup: initialData?.schemaMarkup || "",
      ogTitle: initialData?.ogTitle || "",
      ogDescription: initialData?.ogDescription || "",
      ogImage: initialData?.ogImage || "",
      twitterCard: initialData?.twitterCard || "",
      twitterTitle: initialData?.twitterTitle || "",
      twitterDescription: initialData?.twitterDescription || "",
      twitterImage: initialData?.twitterImage || "",
      pageContent: initialData?.pageContent || "",
    },
  });

  const onSubmit = async (data: UpsertSeoMetadataDto) => {
    try {
      if (!data.path || !data.path.trim()) {
        notify.error("Path is required");
        return;
      }
      if (!data.path.startsWith("/")) {
        notify.error("Path must start with /");
        return;
      }
      // Strip empty string values — backend @IsNotEmpty() rejects "" for required fields
      // Also strip 'id' because the deployed backend does not whitelist it, causing "property id should not exist"
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([k, v]) => k !== "id" && v !== "" && v !== null && v !== undefined)
      ) as UpsertSeoMetadataDto;
      await upsertMutation.mutateAsync(cleanedData);
      notify.success("SEO Metadata saved successfully");
      if (onCancel) {
        onCancel();
      } else {
        router.push("/cms/seo-metadata");
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      notify.error(Array.isArray(msg) ? msg.join(", ") : msg || "Failed to save SEO Metadata");
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/cms/seo-metadata");
    }
  };

  const inputClass = "h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300";
  const textareaClass = "border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="rounded-[20px] bg-white border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
          <CardHeader className="pb-3 p-6">
            <CardTitle className="text-lg font-bold text-[#0F172A]">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-[#0F172A] text-sm">Path / URL Slug *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. /, /stocks, /about-us" className={inputClass} {...field} />
                  </FormControl>
                  <FormDescription className="text-xs text-[#64748B]">The exact path this SEO data applies to.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="metaTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">Meta Title</FormLabel>
                    <FormControl>
                      <Input placeholder="SEO Title" className={inputClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metaDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">Meta Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="SEO Description" className={textareaClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="pageContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-[#0F172A] text-sm">Page Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Optional introductory text or HTML content to inject" 
                      className={`${textareaClass} min-h-[100px]`}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-[#64748B]">HTML is supported.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[20px] bg-white border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
          <CardHeader className="pb-3 p-6">
            <CardTitle className="text-lg font-bold text-[#0F172A]">Structured Data (Schema.org)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <FormField
              control={form.control}
              name="schemaMarkup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-[#0F172A] text-sm">JSON-LD Schema</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "WebPage"\n}'} 
                      className={`${textareaClass} font-mono min-h-[150px]`}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-[#64748B]">Valid JSON object without the script tags.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[20px] bg-white border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
          <CardHeader className="pb-3 p-6">
            <CardTitle className="text-lg font-bold text-[#0F172A]">Social Meta Tags</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-6">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A] border-b border-neutral-100 pb-2 mb-4">Open Graph (Facebook, LinkedIn)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="ogTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">OG Title</FormLabel>
                    <FormControl><Input className={inputClass} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="ogDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">OG Description</FormLabel>
                    <FormControl><Input className={inputClass} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="ogImage" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">OG Image URL</FormLabel>
                    <FormControl><Input className={inputClass} {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm text-[#0F172A] border-b border-neutral-100 pb-2 mb-4">Twitter</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="twitterTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">Twitter Title</FormLabel>
                    <FormControl><Input className={inputClass} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="twitterDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">Twitter Description</FormLabel>
                    <FormControl><Input className={inputClass} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="twitterImage" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">Twitter Image URL</FormLabel>
                    <FormControl><Input className={inputClass} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="twitterCard" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-[#0F172A] text-sm">Twitter Card Type</FormLabel>
                    <FormControl><Input placeholder="summary_large_image" className={inputClass} {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleCancel}
            className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={upsertMutation.isPending}
            className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
          >
            {upsertMutation.isPending ? "Saving..." : "Save SEO Settings"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

