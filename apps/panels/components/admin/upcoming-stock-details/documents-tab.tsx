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

  const { data: freshDocuments = documents, isLoading } = useUpcomingStockDocuments(upcomingStockId);
  const createMutation = useCreateUpcomingStockDocument();
  const updateMutation = useUpdateUpcomingStockDocument();
  const deleteMutation = useDeleteUpcomingStockDocument();

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
      const uploadResult = await uploadUpcomingStockDocument(file);
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

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'ANNUAL':
        return 'default';
      case 'QUARTERLY':
        return 'secondary';
      case 'RESEARCH':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const groupedDocuments = currentDocuments.reduce((acc, doc) => {
    if (!acc[doc.type!]) acc[doc.type!] = [];
    acc[doc.type!]!.push(doc);
    return acc;
  }, {} as Record<string, UpcomingStockDocument[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Documents</h3>
          <p className="text-sm text-muted-foreground">
            Upload and manage documents like annual reports, quarterly results, and research reports.
          </p>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading documents...</span>
        </div>
      ) : currentDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents uploaded yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Upload documents to provide investors with important company information.
            </p>
            <Button onClick={openAddForm}>
              <Upload className="mr-2 h-4 w-4" />
              Upload First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([type, docs]) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant={getTypeBadgeVariant(type)}>{type}</Badge>
                  <span className="text-base">
                    {docs.length} document{docs.length !== 1 ? 's' : ''}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell className="font-medium">{document.name}</TableCell>
                        <TableCell>{new Date(document.uploadedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(document.url, '_blank')}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditForm(document)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsDeleting(document.id)}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDocument ? 'Edit Document' : 'Upload Document'}</DialogTitle>
            <DialogDescription>
              {editingDocument
                ? 'Update document information.'
                : 'Upload a new document. Supported formats: PDF, JPEG, PNG (max 5MB).'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Document Name *</Label>
              <Input id="name" placeholder="e.g., Annual Report 2023" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Document Type *</Label>
              <Select onValueChange={(value) => setValue('type', value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNUAL">Annual Report</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly Report</SelectItem>
                  <SelectItem value="RESEARCH">Research Report</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              {selectedType && <p className="text-xs text-muted-foreground">Selected: {selectedType}</p>}
            </div>

            {!editingDocument && (
              <div className="space-y-2">
                <Label htmlFor="file">File *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
                {uploadingFile && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {uploadingFile.name} ({(uploadingFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
                {previewUrl && (
                  <div className="mt-2">
                    <img src={previewUrl} alt="Preview" className="max-w-full h-32 object-cover rounded border" />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" placeholder="https://..." {...register('url')} disabled />
              {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
              {!editingDocument && <p className="text-xs text-muted-foreground">The URL is auto-filled after upload.</p>}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createMutation.isPending || updateMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingDocument ? 'Update Document' : 'Upload Document'}
              </Button>
            </div>
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
