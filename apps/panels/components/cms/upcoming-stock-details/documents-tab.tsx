'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, FileText, Download, Upload } from 'lucide-react';
import {
  upcomingDocumentSchema,
  upcomingDocumentEditSchema,
  type UpcomingDocumentFormData,
  type UpcomingDocumentEditFormData,
} from '@/lib/validations/upcoming-stock-details-schema';
import { validateFile, generatePreview } from '@/lib/upload-utils';
import {
  useUpcomingStockDocuments,
  useCreateUpcomingStockDocument,
  useUpdateUpcomingStockDocument,
  useDeleteUpcomingStockDocument,
} from '@/hooks/use-admin-upcoming-stock-details';
import { uploadUpcomingStockDocument } from '@/lib/upcoming-stocks-details-api';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import type { UpcomingStockDocument } from '@/types/stock';

interface UpcomingDocumentsTabProps {
  upcomingStockId: string;
  documents: UpcomingStockDocument[];
  onUpdate: () => void;
}

export function UpcomingDocumentsTab({ upcomingStockId, documents, onUpdate }: UpcomingDocumentsTabProps) {
  const [editingDocument, setEditingDocument] = useState<UpcomingStockDocument | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: freshDocuments = documents, isLoading } = useUpcomingStockDocuments(upcomingStockId, true);
  const createMutation = useCreateUpcomingStockDocument(true);
  const updateMutation = useUpdateUpcomingStockDocument(true);
  const deleteMutation = useDeleteUpcomingStockDocument(true);

  const currentDocuments = freshDocuments.length > 0 ? freshDocuments : documents;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<UpcomingDocumentFormData | UpcomingDocumentEditFormData>({
    resolver: zodResolver((editingDocument ? upcomingDocumentEditSchema : upcomingDocumentSchema) as any),
  });

  const selectedType = watch('type');

  const openAddForm = () => {
    reset();
    setEditingDocument(null);
    setUploadingFile(null);
    setPreviewUrl(null);
    setIsFormOpen(true);
  };

  const openEditForm = (document: UpcomingStockDocument) => {
    reset();
    setValue('name', document.name);
    setValue('type', document.type);
    setValue('url', document.url);
    setEditingDocument(document);
    setUploadingFile(null);
    setPreviewUrl(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    reset();
    setEditingDocument(null);
    setUploadingFile(null);
    setPreviewUrl(null);
    setIsFormOpen(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    setUploadingFile(file);

    if (file.type.startsWith('image/')) {
      try {
        const preview = await generatePreview(file);
        setPreviewUrl(preview);
      } catch (error) {
        console.error('Failed to generate preview:', error);
      }
    }

    try {
      const uploadResult = await uploadUpcomingStockDocument(file, true);
      setValue('url', uploadResult.url);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
      setUploadingFile(null);
      setPreviewUrl(null);
    }
  };

  const onSubmit = async (data: UpcomingDocumentFormData | UpcomingDocumentEditFormData) => {
    try {
      if (editingDocument) {
        await updateMutation.mutateAsync({
          upcomingStockId,
          documentId: editingDocument.id,
          dto: {
            name: data.name,
            type: data.type,
          },
        });
      } else {
        const createData = data as UpcomingDocumentFormData;
        await createMutation.mutateAsync({
          upcomingStockId,
          dto: {
            name: createData.name,
            url: createData.url,
            type: createData.type,
          },
        });
      }

      closeForm();
      onUpdate();
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      await deleteMutation.mutateAsync({ upcomingStockId, documentId });
      setIsDeleting(null);
      onUpdate();
    } catch {
      // Error handled by mutation
    }
  };

  const getTypeBadgeClass = (type: string) => {
    const base = "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors";
    switch (type) {
      case 'ANNUAL': 
        return `${base} bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20`;
      case 'QUARTERLY': 
        return `${base} bg-[#EFF6FF] text-[#3B82F6] border-[#3B82F6]/20`;
      case 'RESEARCH': 
        return `${base} bg-[#FEF3C7] text-[#D97706] border-[#F59E0B]/20`;
      default: 
        return `${base} bg-neutral-50 text-[#64748B] border-neutral-200/60`;
    }
  };

  const groupedDocuments = currentDocuments.reduce((acc, doc) => {
    if (!acc[doc.type!]) acc[doc.type!] = [];
    acc[doc.type!]!.push(doc);
    return acc;
  }, {} as Record<string, UpcomingStockDocument[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#0F172A]">Documents</h3>
          <p className="text-xs font-medium text-[#64748B] mt-1">
            Upload and manage documents like annual reports, quarterly results, and research reports.
          </p>
        </div>
        <Button 
          onClick={openAddForm}
          className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center gap-2 outline-none"
        >
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#16A34A]" />
          <span className="ml-2 text-sm text-[#64748B] font-medium">Loading documents...</span>
        </div>
      ) : currentDocuments.length === 0 ? (
        <div 
          className="flex flex-col items-center justify-center p-12 bg-white rounded-[20px] border border-neutral-200/40 text-center"
          style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
        >
          <FileText className="h-8 w-8 text-[#64748B] mb-3" />
          <h3 className="text-sm font-semibold text-[#0F172A]">No Documents Uploaded Yet</h3>
          <p className="text-xs text-[#64748B] mt-1 max-w-[280px]">
            Upload documents to provide investors with important company information.
          </p>
          <Button 
            onClick={openAddForm}
            className="mt-4 h-9 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] rounded-xl font-semibold text-xs px-3.5 py-1.5 transition-all duration-300 ease-in-out flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload First Document
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([type, docs]) => (
            <div 
              key={type} 
              className="border border-neutral-200/40 rounded-[24px] bg-white overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.03)]"
            >
              <div className="bg-[#FAFBFC] border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={getTypeBadgeClass(type)}>{type}</span>
                  <span className="text-xs font-semibold text-[#64748B]">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="p-0">
                <Table>
                  <TableHeader className="bg-transparent">
                    <TableRow className="hover:bg-transparent border-b border-neutral-100">
                      <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3 pl-6">Name</TableHead>
                      <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3">Uploaded</TableHead>
                      <TableHead className="uppercase tracking-wider text-xs font-bold text-[#64748B] py-3 text-right pr-6 w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((document) => (
                      <TableRow key={document.id} className="hover:bg-[#F8FAFC] transition-colors border-b border-neutral-100/60">
                        <TableCell className="font-semibold text-sm text-[#0F172A] py-3.5 pl-6">{document.name}</TableCell>
                        <TableCell className="text-sm font-medium text-[#64748B] py-3.5">
                          {new Date(document.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right py-3.5 pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(document.url, '_blank')}
                              className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditForm(document)}
                              className="h-8 w-8 text-[#64748B] hover:text-[#16A34A] hover:bg-[#ECFDF5] rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsDeleting(document.id)}
                              className="h-8 w-8 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="rounded-3xl border border-neutral-200 bg-white shadow-2xl p-6 overflow-hidden max-w-md">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingDocument ? 'Edit Document' : 'Upload Document'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-[#64748B] mt-1">
              {editingDocument
                ? 'Update document information.'
                : 'Upload a new document. Supported formats: PDF, JPEG, PNG (max 5MB).'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Document Name *</Label>
              <Input 
                id="name" 
                placeholder="e.g., Annual Report 2023" 
                className="h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 w-full"
                {...register('name')} 
              />
              {errors.name && <p className="text-xs text-red-500 font-semibold">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Document Type *</Label>
              <Select onValueChange={(value) => setValue('type', value as any)}>
                <SelectTrigger className="w-full h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 rounded-[14px] bg-white text-gray-900 outline-none transition-all duration-300">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-neutral-200 shadow-lg">
                  <SelectItem value="ANNUAL">Annual Report</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly Report</SelectItem>
                  <SelectItem value="RESEARCH">Research Report</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-red-500 font-semibold">{errors.type.message}</p>}
            </div>

            {!editingDocument && (
              <div className="space-y-1.5">
                <Label htmlFor="file" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">File *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  className="h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300 w-full cursor-pointer file:bg-neutral-100 file:border-0 file:rounded-lg file:text-xs file:font-semibold file:text-[#0F172A] file:mr-3 file:px-3 file:py-1 file:hover:bg-neutral-200"
                />
                {uploadingFile && (
                  <div className="text-xs font-medium text-[#64748B] mt-1">
                    Selected: {uploadingFile.name} ({(uploadingFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
                {previewUrl && (
                  <div className="mt-2.5">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="max-w-full h-32 object-cover rounded-[14px] border border-neutral-200/50" 
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="url" className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">URL</Label>
              <Input 
                id="url" 
                placeholder="https://..." 
                className="h-10 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-[#FAFBFC] text-[#64748B] placeholder:text-gray-400 outline-none transition-all duration-300 w-full"
                {...register('url')} 
                disabled 
              />
              {errors.url && <p className="text-xs text-red-500 font-semibold">{errors.url.message}</p>}
              {!editingDocument && (
                <p className="text-[11px] font-medium text-[#64748B]/80 leading-normal">
                  The URL is auto-filled after upload.
                </p>
              )}
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={closeForm} 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-sm px-4 py-2 h-10 transition-all duration-300 ease-in-out active:scale-[0.98] disabled:opacity-50 outline-none"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending || (!editingDocument && !uploadingFile)}
                className="h-10 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-xl font-semibold text-sm px-4 py-2 transition-all duration-300 ease-in-out flex items-center justify-center outline-none"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingDocument ? 'Update Document' : 'Upload Document'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={!!isDeleting}
        onClose={() => setIsDeleting(null)}
        onConfirm={() => isDeleting && handleDelete(isDeleting)}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
