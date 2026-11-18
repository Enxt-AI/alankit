'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Search,
  Image,
  AlertCircle,
  Upload,
  GripVertical,
  Play,
  Eye,
  EyeOff,
  Pencil,
  Video,
  X,
  FileImage,
  Link,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import {
  useCmsCarouselMedia,
  useCreateCarouselMedia,
  useUpdateCarouselMedia,
  useDeleteCarouselMedia,
  useReorderCarouselMedia,
} from '@/hooks/use-carousel-media';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn, getStorageUrl } from '@/lib/utils';
import type { CarouselMedia, CreateCarouselMediaDto, UpdateCarouselMediaDto } from '@/types/carousel';
import { stocksApi } from '@/lib/api-client';

/**
 * Load stored images through the same-origin storage proxy.
 */
function CarouselImagePreview({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const currentSrc = getStorageUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // A replacement upload gets a fresh preview even if the previous file failed.
  if (!currentSrc || failedSrc === currentSrc) {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center bg-neutral-100 text-neutral-400 p-3 text-center", className)}>
        <FileImage className="h-8 w-8 mb-1.5 text-neutral-400" />
        <span className="text-[11px] font-medium text-neutral-500 line-clamp-1">{alt || 'Banner'}</span>
        <span className="text-[11px] text-neutral-500">Image preview unavailable</span>
      </div>
    );
  }

  return (
    <img
      key={currentSrc}
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(currentSrc)}
    />
  );
}

function getMediaUrl(path: string): string {
  return getStorageUrl(path);
}

/**
 * Upload a file to MinIO via storage-service.
 * Uses the existing /api/upload/:bucket/:prefix endpoint.
 */
async function uploadCarouselFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await stocksApi.post('/upload/carousel/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // 60s for large files
  });

  return response.data.url;
}

const MEDIA_TYPE_OPTIONS = [
  { value: 'IMAGE', label: 'Image', icon: FileImage },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'GIF', label: 'GIF', icon: Image },
];

const LINK_TYPE_OPTIONS = [
  { value: 'NONE', label: 'No Link' },
  { value: 'STOCK', label: 'Stock Page' },
  { value: 'ARTICLE', label: 'Article' },
  { value: 'NEWS', label: 'News' },
  { value: 'URL', label: 'Custom URL' },
];

export default function CMSCarouselPage() {
  const { cmsAdmin } = useCMSAuth();
  const hasPermission =
    cmsAdmin?.permissions?.includes('cms_carousel') ||
    cmsAdmin?.role === 'SUPER_ADMIN';

  if (!hasPermission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Carousel Media</h1>
            <p className="text-muted-foreground">
              Manage carousel media for the mobile app
            </p>
          </div>
        </div>
        <Alert>
          <AlertDescription>
            You do not have permission to manage carousel media. Contact your
            administrator to enable{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              cms_carousel
            </code>{' '}
            permission.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <CarouselMediaContent />;
}

function CarouselMediaContent() {
  const { data: mediaItems = [], isLoading, error, refetch } = useCmsCarouselMedia(true);
  const createMutation = useCreateCarouselMedia();
  const updateMutation = useUpdateCarouselMedia();
  const deleteMutation = useDeleteCarouselMedia();
  const reorderMutation = useReorderCarouselMedia();

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedItem, setSelectedItem] = useState<CarouselMedia | undefined>();

  // Form state
  const [formData, setFormData] = useState<CreateCarouselMediaDto>({
    title: '',
    description: '',
    mediaType: 'IMAGE',
    mediaUrl: '',
    thumbnailUrl: '',
    linkUrl: '',
    linkType: 'NONE',
    displayOrder: 0,
    isActive: true,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Preview modal
  const [previewItem, setPreviewItem] = useState<CarouselMedia | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter by search
  const filtered = mediaItems.filter((item) => {
    const query = debounced.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      (item.description || '').toLowerCase().includes(query)
    );
  });

  // Handlers
  const openCreateForm = () => {
    setFormMode('create');
    setSelectedItem(undefined);
    setFormData({
      title: '',
      description: '',
      mediaType: 'IMAGE',
      mediaUrl: '',
      thumbnailUrl: '',
      linkUrl: '',
      linkType: 'NONE',
      displayOrder: mediaItems.length,
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const openEditForm = (item: CarouselMedia) => {
    setFormMode('edit');
    setSelectedItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      mediaType: item.mediaType as 'IMAGE' | 'VIDEO' | 'GIF',
      mediaUrl: item.mediaUrl,
      thumbnailUrl: item.thumbnailUrl || '',
      linkUrl: item.linkUrl || '',
      linkType: (item.linkType || 'NONE') as any,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    });
    setIsFormOpen(true);
  };

  const openDeleteDialog = (item: CarouselMedia) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    // Validate file
    const maxSize = 50; // 50MB
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File is too large. Maximum size is ${maxSize}MB.`);
      return;
    }

    let detectedType: 'IMAGE' | 'VIDEO' | 'GIF' = 'IMAGE';
    if (file.type.startsWith('video/')) {
      detectedType = 'VIDEO';
    } else if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
      detectedType = 'GIF';
    }

    const defaultTitle = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const url = await uploadCarouselFile(file);
      setFormData((prev) => ({
        ...prev,
        mediaUrl: url,
        mediaType: detectedType,
        title: prev.title?.trim() ? prev.title : (defaultTitle || 'Banner'),
      }));
      setUploadProgress('');
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert('Failed to upload file. Please try again.');
      setUploadProgress('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.mediaUrl.trim()) {
      alert('Please upload an image first.');
      return;
    }

    const finalPayload = {
      ...formData,
      title: formData.title?.trim() || 'Banner',
    };

    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(finalPayload);
      } else if (selectedItem) {
        await updateMutation.mutateAsync({ id: selectedItem.id, dto: finalPayload });
      }
      setIsFormOpen(false);
    } catch {
      // Error handled by mutation hooks
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      await deleteMutation.mutateAsync(selectedItem.id);
      setIsDeleteOpen(false);
    } catch {
      // Error handled by mutation hook
    }
  };

  const toggleActive = async (item: CarouselMedia) => {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        dto: { isActive: !item.isActive },
      });
    } catch {
      // Error handled by mutation hook
    }
  };

  const moveItem = async (item: CarouselMedia, direction: 'up' | 'down') => {
    const sorted = [...mediaItems].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((i) => i.id === item.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const current = sorted[idx];
    const target = sorted[swapIdx];
    if (!current || !target) return;

    const newItems = [
      { id: current.id, displayOrder: target.displayOrder },
      { id: target.id, displayOrder: current.displayOrder },
    ];

    try {
      await reorderMutation.mutateAsync(newItems);
    } catch {
      // Error handled by mutation hook
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending || isUploading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carousel Media</h1>
          <p className="text-muted-foreground">Manage carousel media for the mobile app</p>
        </div>
        <AdminTableSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carousel Media</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load carousel media. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carousel Media</h1>
          <p className="text-muted-foreground">
            Upload images, videos, and GIFs for the Android app carousel.
            {mediaItems.length > 0 && (
              <span className="ml-1 text-xs">
                ({mediaItems.filter((m) => m.isActive).length} active / {mediaItems.length} total)
              </span>
            )}
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-2 bg-[#16A34A] hover:bg-[#15803D] font-semibold">
          <Upload className="h-4 w-4" />
          Upload Banner
        </Button>
      </div>

      {/* Search */}
      {mediaItems.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search carousel items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Empty State */}
      {mediaItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-12 text-center">
          <div className="rounded-2xl bg-[#ECFDF5] p-4 mb-4">
            <Image className="h-8 w-8 text-[#16A34A]" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-800">No Carousel Images Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            Upload images or GIFs to show in the mobile app carousel.
          </p>
          <Button onClick={openCreateForm} className="mt-4 gap-2 bg-[#16A34A] hover:bg-[#15803D] font-semibold">
            <Upload className="h-4 w-4" />
            Upload First Image
          </Button>
        </div>
      )}

      {/* Media Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.sort((a, b) => a.displayOrder - b.displayOrder).map((item) => (
            <div
              key={item.id}
              className={cn(
                'group relative rounded-xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-all',
                !item.isActive && 'opacity-60 border-dashed'
              )}
            >
              {/* Media Preview */}
              <div
                className="relative aspect-video bg-neutral-100 cursor-pointer"
                onClick={() => setPreviewItem(item)}
              >
                {item.mediaType === 'VIDEO' ? (
                  <div className="flex items-center justify-center h-full bg-neutral-900/5">
                    {item.thumbnailUrl ? (
                      <CarouselImagePreview
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="h-12 w-12 text-neutral-400" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-white/90 p-3 shadow-lg">
                        <Play className="h-6 w-6 text-neutral-800 fill-neutral-800" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <CarouselImagePreview
                    src={item.mediaUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Type Badge */}
                <div className="absolute top-2 left-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] font-bold uppercase',
                      item.mediaType === 'IMAGE' && 'bg-blue-100 text-blue-700',
                      item.mediaType === 'VIDEO' && 'bg-purple-100 text-purple-700',
                      item.mediaType === 'GIF' && 'bg-orange-100 text-orange-700'
                    )}
                  >
                    {item.mediaType}
                  </Badge>
                </div>

                {/* Order Badge */}
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="bg-white/90 text-[10px] font-mono">
                    #{item.displayOrder + 1}
                  </Badge>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate text-neutral-800">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(item)}
                    className="shrink-0"
                    title={item.isActive ? 'Click to hide' : 'Click to show'}
                  >
                    {item.isActive ? (
                      <Eye className="h-4 w-4 text-[#16A34A]" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-neutral-400" />
                    )}
                  </button>
                </div>

                {item.linkType && item.linkType !== 'NONE' && (
                  <div className="flex items-center gap-1">
                    <Link className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground truncate">
                      {item.linkType}: {item.linkUrl || '-'}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveItem(item, 'up')}
                      className="p-1 rounded hover:bg-neutral-100 transition-colors"
                      title="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5 text-neutral-500" />
                    </button>
                    <button
                      onClick={() => moveItem(item, 'down')}
                      className="p-1 rounded hover:bg-neutral-100 transition-colors"
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5 text-neutral-500" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditForm(item)}
                      className="p-1 rounded hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5 text-blue-600" />
                    </button>
                    <button
                      onClick={() => openDeleteDialog(item)}
                      className="p-1 rounded hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {mediaItems.length > 0 && filtered.length === 0 && debounced && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No carousel items match &quot;{debounced}&quot;</p>
        </div>
      )}

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? 'Upload Carousel Image' : 'Edit Carousel Banner'}
            </DialogTitle>
            <DialogDescription>
              Upload an image, GIF, or video for your mobile app carousel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Simple Upload Box */}
            <div>
              {formData.mediaUrl ? (
                <div className="relative rounded-xl border border-neutral-200 overflow-hidden bg-neutral-900/5">
                  {formData.mediaType === 'VIDEO' ? (
                    <div className="flex flex-col items-center justify-center h-48 bg-neutral-900">
                      <Video className="h-10 w-10 text-white/80 mb-2" />
                      <span className="text-xs text-white/60">Video banner ready</span>
                    </div>
                  ) : (
                    <CarouselImagePreview
                      src={formData.mediaUrl}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, mediaUrl: '' }));
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700 shadow-md flex items-center gap-1.5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all',
                    isUploading
                      ? 'border-yellow-400 bg-yellow-50/50'
                      : 'border-neutral-300 hover:border-[#16A34A] hover:bg-[#ECFDF5]/40 bg-neutral-50/50'
                  )}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-8 w-8 text-yellow-600 animate-spin mb-2" />
                      <span className="text-sm font-semibold text-yellow-700">{uploadProgress}</span>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-[#DCFCE7] rounded-full text-[#16A34A] mb-3 shadow-sm">
                        <Upload className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-semibold text-neutral-800">
                        Click to select image or GIF
                      </span>
                      <span className="text-xs text-neutral-400 mt-1">
                        PNG, JPG, WEBP, GIF, or MP4 (up to 50MB)
                      </span>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>

            {/* Optional Link / Name Accordion */}
            <details className="group border border-neutral-200 rounded-xl p-3 text-sm bg-neutral-50/40">
              <summary className="cursor-pointer font-medium text-neutral-600 flex items-center justify-between select-none list-none">
                <span className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
                  <Link className="h-3.5 w-3.5 text-neutral-400" />
                  Optional: Add click link or change name
                </span>
                <span className="text-[11px] text-neutral-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="space-y-3 mt-3 pt-3 border-t border-neutral-200/60">
                <div className="space-y-1">
                  <Label htmlFor="carousel-title" className="text-xs text-neutral-500">
                    Banner Name
                  </Label>
                  <Input
                    id="carousel-title"
                    placeholder="Auto-detected from file name"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="carousel-link" className="text-xs text-neutral-500">
                    Click Link / URL
                  </Label>
                  <Input
                    id="carousel-link"
                    placeholder="e.g. /stocks/hdfc or https://example.com"
                    value={formData.linkUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        linkUrl: e.target.value,
                        linkType: e.target.value.trim() ? 'URL' : 'NONE',
                      }))
                    }
                  />
                  <p className="text-[10px] text-neutral-400">
                    Leave blank if this banner doesn&apos;t need to open anything when tapped.
                  </p>
                </div>
              </div>
            </details>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-neutral-200/70 p-3 bg-white">
              <div>
                <Label className="text-xs font-semibold text-neutral-700">Show in Carousel</Label>
                <p className="text-[11px] text-muted-foreground">
                  Enable to make this banner visible immediately in the app
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isBusy || !formData.mediaUrl}
              className="bg-[#16A34A] hover:bg-[#15803D] gap-2 font-semibold"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {formMode === 'create' ? 'Save & Add to Carousel' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Carousel Media</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedItem?.title}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Preview Dialog ─── */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        {previewItem && (
          <DialogContent className="max-w-2xl p-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>{previewItem.title}</DialogTitle>
              {previewItem.description && (
                <DialogDescription>{previewItem.description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="p-4 pt-2">
              {previewItem.mediaType === 'VIDEO' ? (
                <video
                  src={getMediaUrl(previewItem.mediaUrl)}
                  controls
                  className="w-full rounded-lg"
                  poster={previewItem.thumbnailUrl ? getMediaUrl(previewItem.thumbnailUrl) : undefined}
                />
              ) : (
                <CarouselImagePreview
                  src={previewItem.mediaUrl || ''}
                  alt={previewItem.title || 'Preview'}
                  className="w-full rounded-lg object-contain max-h-[60vh]"
                />
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
