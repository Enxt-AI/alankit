"use client";

import { useAllSeoMetadata, useDeleteSeoMetadata } from "@/hooks/use-seo-metadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useState } from "react";
import { SeoMetadataForm } from "@/components/cms/seo-metadata-form";
import type { SeoMetadata } from "@/lib/seo-metadata-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function SeoMetadataPage() {
  const router = useRouter();
  const { data: seoList, isLoading } = useAllSeoMetadata();
  const deleteMutation = useDeleteSeoMetadata();
  const [editingSeo, setEditingSeo] = useState<SeoMetadata | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Global SEO Metadata</h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Manage SEO meta tags, Open Graph, and Structured Data for any page path.
            </p>
          </div>
        </div>
        <div className="rounded-[24px] border border-neutral-200/40 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.03)] p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16A34A] mx-auto mb-4"></div>
          <p className="text-sm font-medium text-[#64748B]">Loading SEO metadata...</p>
        </div>
      </div>
    );
  }

  if (editingSeo) {
    return (
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
            {editingSeo === "new" ? "Add SEO Metadata" : `Edit SEO for ${editingSeo.path}`}
          </h1>
          <Button 
            variant="outline" 
            onClick={() => setEditingSeo(null)}
            className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
          >
            Back to List
          </Button>
        </div>
        <SeoMetadataForm initialData={editingSeo === "new" ? undefined : editingSeo} onCancel={() => setEditingSeo(null)} />
      </div>
    );
  }

  const handleDelete = async () => {
    if (deletingId) {
      await deleteMutation.mutateAsync(deletingId);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Global SEO Metadata</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Manage SEO meta tags, Open Graph, and Structured Data for any page path.
          </p>
        </div>
        <Button 
          onClick={() => setEditingSeo("new")}
          className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Path
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {seoList?.map((seo) => (
          <Card 
            key={seo.id}
            className="rounded-[20px] bg-white border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
          >
            <CardHeader className="pb-3 p-6">
              <CardTitle className="flex justify-between items-start text-base font-semibold text-[#0F172A]">
                <code className="bg-neutral-100 text-[#0F172A] px-2 py-1 rounded-[6px] text-xs font-mono border border-neutral-200/50 truncate max-w-[180px]" title={seo.path}>
                  {seo.path}
                </code>
                <div className="flex gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors" 
                    onClick={() => setEditingSeo(seo)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                    onClick={() => setDeletingId(seo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-[#64748B] mt-2 line-clamp-1">
                {seo.metaTitle || "No title set"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 text-sm">
              <p className="line-clamp-2 text-[#64748B] mb-4 text-xs font-medium">
                {seo.metaDescription || "No description set"}
              </p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {seo.schemaMarkup && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                    Schema
                  </span>
                )}
                {seo.ogTitle && (
                  <span className="bg-[#EFF6FF] text-[#2563EB] border border-[#3B82F6]/20 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                    OG
                  </span>
                )}
                {seo.twitterTitle && (
                  <span className="bg-sky-50 text-sky-700 border border-sky-200/60 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                    Twitter
                  </span>
                )}
                {seo.pageContent && (
                  <span className="bg-purple-50 text-purple-700 border border-purple-200/60 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                    Content
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {seoList?.length === 0 && (
          <div 
            className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center"
            style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
          >
            <Plus className="mb-3 h-8 w-8 text-[#64748B]" />
            <h3 className="text-sm font-semibold text-[#0F172A]">No SEO Metadata Paths Found</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
              Click "Add Path" to get started.
            </p>
          </div>
        )}
      </div>

      <Dialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <DialogContent className="rounded-3xl border border-neutral-200 bg-white shadow-2xl p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">Delete SEO configuration?</DialogTitle>
            <DialogDescription className="text-sm text-[#64748B] mt-2">
              Are you sure you want to delete this SEO configuration? The page will fall back to its default tags.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-6">
            <Button 
              variant="outline" 
              onClick={() => setDeletingId(null)}
              className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDelete} 
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-white text-white hover:text-red-600 border-2 border-red-600 active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

