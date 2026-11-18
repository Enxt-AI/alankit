'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, FileText, Download, Upload } from 'lucide-react';
import { documentSchema, documentEditSchema, type DocumentFormData, type DocumentEditFormData } from '@/lib/validations/stock-details-schema';
import { validateFile, generatePreview } from '@/lib/upload-utils';
import { useAdminDocuments, useCreateAdminDocument, useUpdateAdminDocument, useDeleteAdminDocument } from '@/hooks/use-admin-stock-details';
import { uploadDocumentAdmin } from '@/lib/admin-api';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import type { StockDocument } from '@/types/stock';

interface DocumentsTabProps {
  stockId: string;
  documents: StockDocument[];
  onUpdate: () => void;
}

export function DocumentsTab({ stockId, documents, onUpdate }: DocumentsTabProps) {
  const [editingDocument, setEditingDocument] = useState<StockDocument | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: freshDocuments = documents, isLoading } = useAdminDocuments(stockId);
  const createMutation = useCreateAdminDocument();
  const updateMutation = useUpdateAdminDocument();
  const deleteMutation = useDeleteAdminDocument();

  const currentDocuments = freshDocuments.length > 0 ? freshDocuments : documents;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<DocumentFormData | DocumentEditFormData>({
    resolver: zodResolver((editingDocument ? documentEditSchema : documentSchema) as any),
  });

  const selectedType = watch('type');

  const openAddForm = () => {
    reset();
    setEditingDocument(null);
    setUploadingFile(null);
    setPreviewUrl(null);
    setIsFormOpen(true);
  };

  const openEditForm = (document: StockDocument) => {
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

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      try {
        const preview = await generatePreview(file);
        setPreviewUrl(preview);
      } catch (error) {
        console.error('Failed to generate preview:', error);
      }
    }

    // Upload file immediately
    try {
      const uploadResult = await uploadDocumentAdmin(file);
      setValue('url', uploadResult.url);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
      setUploadingFile(null);
      setPreviewUrl(null);
    }
  };

  const onSubmit = async (data: DocumentFormData | DocumentEditFormData) => {
    try {
      if (editingDocument) {
        await updateMutation.mutateAsync({
          stockId,
          documentId: editingDocument.id,
          dto: {
            name: data.name,
            type: data.type,
          },
        });
      } else {
        // For creating, we know data is DocumentFormData with required url
        const createData = data as DocumentFormData;
        await createMutation.mutateAsync({
          stockId,
          dto: {
            name: createData.name,
            url: createData.url,
            type: createData.type,
          },
        });
      }

      closeForm();
      onUpdate();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      await deleteMutation.mutateAsync({ stockId, documentId });
      setIsDeleting(null);
      onUpdate();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'ANNUAL': return 'default';
      case 'QUARTERLY': return 'secondary';
      case 'RESEARCH': return 'outline';
      default: return 'secondary';
    }
  };

  const groupedDocuments = currentDocuments.reduce((acc, doc) => {
    if (!acc[doc.type!]) acc[doc.type!] = [];
    acc[doc.type!]!.push(doc);
    return acc;
  }, {} as Record<string, StockDocument[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Documents</h3>
          <p className="text-sm text-muted-foreground">
            Upload and manage company documents like annual reports, quarterly results, and research reports.
          </p>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Documents List */}
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
                  <span className="text-base">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
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
                        <TableCell>
                          {new Date(document.uploadedAt).toLocaleDateString()}
                        </TableCell>
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

      {/* Document Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDocument ? 'Edit Document' : 'Upload Document'}
            </DialogTitle>
            <DialogDescription>
              {editingDocument
                ? 'Update document information.'
                : 'Upload a new document. Supported formats: PDF, JPEG, PNG (max 5MB).'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Document Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Annual Report 2023"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
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
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
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
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-full h-32 object-cover rounded border"
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || (!editingDocument && !uploadingFile)}
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

      {/* Delete Confirmation Dialog */}
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