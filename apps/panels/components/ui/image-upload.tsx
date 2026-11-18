import React, { useState, useRef, useCallback } from 'react';
import { notify } from '@/components/ui/floating-notification';
import axios from 'axios';
import { Loader2, Upload, X, Image as ImageIcon, CloudUpload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getStorageUrl } from '@/lib/utils';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  bucketName: string;
  pathPrefix: string;
  useCmsEndpoint?: boolean;
  label?: string;
  compact?: boolean;
  objectFit?: 'contain' | 'cover';
}

export function ImageUpload({
  value,
  onChange,
  bucketName,
  pathPrefix,
  useCmsEndpoint,
  label,
  compact = false,
  objectFit,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayLabel = label || 'Logo';
  const effectiveFit = objectFit || (compact ? 'cover' : 'contain');

  const processFile = useCallback(async (file: File) => {
    // Validate type
    if (!file.type.startsWith('image/')) {
      notify.error('Please upload an image file (JPEG/PNG/WebP)');
      return;
    }
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      notify.error('Image must be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`/api/upload/${bucketName}/${pathPrefix}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
      });
      
      onChange(response.data.url);
      notify.success(`${displayLabel} uploaded successfully`);
    } catch (error: any) {
      notify.error(error.message || `Failed to upload ${displayLabel.toLowerCase()}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [bucketName, pathPrefix, onChange, displayLabel]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  }, [processFile]);

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {value ? (
          /* ── Compact Preview state ── */
          <div className="relative group rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 transition-all hover:border-slate-300 hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-lg border border-slate-200/80 overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={getStorageUrl(value)}
                  alt="Preview"
                  className={`w-full h-full ${effectiveFit === 'cover' ? 'object-cover object-top' : 'object-contain p-1'}`}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-semibold text-slate-700 truncate">{displayLabel} Selected</p>
                <Input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Image URL or path"
                  className="text-[10px] text-muted-foreground bg-white h-6 font-mono truncate"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setManualUrl('');
                }}
                className="h-7 w-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0 transition-colors"
                title="Remove image"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ) : (
          /* ── Compact Upload state (drag & drop + paste URL) ── */
          <div className="space-y-1.5">
            <label
              className={`
                relative cursor-pointer flex items-center gap-3 rounded-xl border-2 border-dashed px-3 py-2.5
                transition-all duration-200 ease-in-out
                ${isDragging
                  ? 'border-emerald-400 bg-emerald-50/60 shadow-xs'
                  : 'border-slate-200 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/30'}
                ${isUploading ? 'pointer-events-none opacity-60' : ''}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-100/60 text-emerald-600 flex items-center justify-center shrink-0">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                  <CloudUpload className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {isUploading ? 'Uploading...' : isDragging ? 'Drop photo here' : `Upload ${displayLabel}`}
                </p>
                <p className="text-[10px] text-slate-400 truncate">Click or drag & drop · PNG, JPG up to 5MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload}
                disabled={isUploading}
              />
            </label>
            <div className="flex items-center gap-1.5 px-0.5">
              <Input
                placeholder="Or paste image URL directly..."
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (manualUrl.trim()) {
                      onChange(manualUrl.trim());
                      setManualUrl('');
                    }
                  }
                }}
                onBlur={() => {
                  if (manualUrl.trim()) {
                    onChange(manualUrl.trim());
                    setManualUrl('');
                  }
                }}
                className="h-6 text-[10px] bg-white border-neutral-200 rounded-md font-mono"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {value ? (
        /* ── Preview state ── */
        <div className="relative group rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 transition-all hover:border-slate-300 hover:shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-lg border border-slate-200/80 overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-sm">
              <img
                src={getStorageUrl(value)}
                alt="Preview"
                className={`max-w-full max-h-full ${effectiveFit === 'cover' ? 'w-full h-full object-cover object-top' : 'object-contain p-1.5'}`}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">{displayLabel} Uploaded</p>
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="text-[11px] text-muted-foreground bg-slate-50/80 h-8 font-mono truncate"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setManualUrl('');
              }}
              className="absolute top-3 right-3 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
              title="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        /* ── Upload state (drag & drop) ── */
        <div className="space-y-2">
          <label
            className={`
              relative cursor-pointer block rounded-xl border-2 border-dashed p-6
              transition-all duration-200 ease-in-out
              ${isDragging
                ? 'border-emerald-400 bg-emerald-50/60 shadow-inner'
                : 'border-slate-300 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/30'}
              ${isUploading ? 'pointer-events-none opacity-60' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center gap-2.5 text-center">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center transition-all
                ${isDragging
                  ? 'bg-emerald-100 text-emerald-600 scale-110'
                  : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-500'}
              `}>
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CloudUpload className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {isUploading ? 'Uploading...' : isDragging ? 'Drop image here' : `Upload ${displayLabel}`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Drag & drop or click to browse · PNG, JPEG, WebP · Max 5MB
                </p>
              </div>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/jpeg,image/png,image/webp" 
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Or paste image URL directly..."
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (manualUrl.trim()) {
                    onChange(manualUrl.trim());
                    setManualUrl('');
                  }
                }
              }}
              onBlur={() => {
                if (manualUrl.trim()) {
                  onChange(manualUrl.trim());
                  setManualUrl('');
                }
              }}
              className="h-8 text-xs bg-white border-neutral-200 rounded-lg font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}
