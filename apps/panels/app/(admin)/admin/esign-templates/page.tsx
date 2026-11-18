"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getESignTemplates, 
  createESignTemplate, 
  uploadESignTemplateHtml,
  deleteESignTemplate
} from "@/lib/settings-api";
import { validateFile } from "@/lib/upload-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Clock, FileKey, FileText, Trash2 } from "lucide-react";
import { notify } from "@/components/ui/floating-notification";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ESignTemplatesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  
  const { data: templates, isLoading } = useQuery({
    queryKey: ["esign-templates"],
    queryFn: getESignTemplates,
  });

  const hasTemplate = !isLoading && templates && templates.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">e-Sign Templates</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Manage the template ID used for e-Sign sessions during checkout.
          </p>
        </div>
        <div>
          <Button 
            onClick={() => setModalOpen(true)} 
            className="gap-2 border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4"
          >
            <Plus className="h-4 w-4" /> Add Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin mx-auto col-span-full" />
        ) : (
          templates?.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))
        )}
        {!isLoading && templates?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center text-center p-8 border border-neutral-200/40 rounded-[20px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-4">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">No e-Sign Templates Found</h3>
            <p className="text-sm text-[#64748B] mt-1.5 max-w-sm">
              No e-Sign Template configured yet. Add a template ID to enable checkout.
            </p>
          </div>
        )}
      </div>

      <AddTemplateModal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["esign-templates"] });
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function TemplateCard({ template }: { template: any }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteESignTemplate(template.id),
    onSuccess: () => {
      notify.success("Template deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["esign-templates"] });
    },
    onError: (err: any) => notify.error(err.message || "Failed to delete template")
  });

  return (
    <Card className={`relative overflow-hidden bg-white rounded-[20px] transition-all duration-300 ease-in-out hover:-translate-y-0.5 ${template.isActive ? 'border-[#16A34A] shadow-[0_16px_40px_rgba(15,23,42,0.08)]' : 'border-neutral-200/40 hover:border-neutral-200 hover:shadow-[0_8px_30px_rgba(15,23,42,0.04)] opacity-75 hover:opacity-100'}`} style={{ boxShadow: template.isActive ? '0 16px 40px rgba(15,23,42,0.08)' : '0 8px 30px rgba(15,23,42,0.04)' }}>
      <CardHeader className={`pb-3 border-b border-neutral-200/40 p-5 ${template.isActive ? 'bg-[#ECFDF5]/30' : 'bg-[#FAFBFC]'}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-[#0F172A] truncate pr-4">e-Sign Template</CardTitle>
            {template.isActive && (
              <span className="bg-[#DCFCE7] text-[#16A34A] text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-[#16A34A]/25">
                Active
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center text-[11px] font-semibold text-[#64748B] gap-2 mt-1">
          <Clock className="h-3 w-3" />
          {format(new Date(template.createdAt), 'PPP')}
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col gap-4">
        {/* Template ID and PDF */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template ID</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#FAFBFC] border border-neutral-200/40 rounded-xl min-w-0">
              <FileKey className="h-4 w-4 text-[#64748B]/60 shrink-0" />
              <code className="text-sm font-mono text-[#0F172A] truncate">{template.templateId || "-"}</code>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">HTML Document</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#FAFBFC] border border-neutral-200/40 rounded-xl min-w-0">
              <FileText className="h-4 w-4 text-[#64748B]/60 shrink-0" />
              <span className="text-sm truncate">
                {template.pdfUrl ? (
                  <a href={template.publicPdfUrl || template.pdfUrl} target="_blank" rel="noreferrer" className="text-[#16A34A] hover:underline font-bold">
                    View Uploaded HTML
                  </a>
                ) : "No HTML uploaded"}
              </span>
            </div>
          </div>
          
          {!template.isActive && (
            <div className="pt-2">
              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full h-10 font-bold rounded-lg transition-all duration-300 ease-in-out active:scale-[0.98]"
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this template? This cannot be undone.")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                Delete Template
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddTemplateModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!templateId.trim()) return notify.error("Please provide the template ID.");
    if (!file) return notify.error("Please upload an HTML document.");

    try {
      setIsSubmitting(true);
      
      const { isValid, error } = validateFile(file, 5, ["text/html"]);
      if (!isValid) throw new Error(error || "Invalid file.");

      const uploadRes = await uploadESignTemplateHtml(file);
      
      await createESignTemplate({ templateId: templateId.trim(), pdfUrl: uploadRes.url });
      notify.success("Template added successfully!");
      onSuccess();
      setTemplateId("");
      setFile(null);
    } catch (err: any) {
       notify.error(err.message || "Failed to create template.");
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[20px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0F172A]">Add e-Sign Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#0F172A]">Template ID</Label>
            <Input 
               placeholder="e.g. ESIG139341352" 
               value={templateId} 
               onChange={(e) => setTemplateId(e.target.value)} 
               disabled={isSubmitting}
               className="font-mono h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
            />
            <p className="text-xs text-muted-foreground">
              This ID will be sent in the <code className="bg-muted px-1 rounded">templateId</code> field of the e-Sign API request.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#0F172A]">HTML Document</Label>
            <Input 
               type="file"
               accept=".html"
               onChange={(e) => setFile(e.target.files?.[0] || null)} 
               disabled={isSubmitting}
               className="h-10 rounded-[14px] border border-neutral-200/60 bg-white text-sm text-[#0F172A] file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#ECFDF5] file:text-[#16A34A] hover:file:bg-[#DCFCE7] focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A] cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Please select the HTML file representing the terms and conditions. Max 5MB.
            </p>
          </div>

          <Button 
            className="w-full mt-4 border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10" 
            disabled={isSubmitting} 
            onClick={handleSubmit}
          >
             {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
             Add Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
