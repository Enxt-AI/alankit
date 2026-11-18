'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { linkDemat } from '@/lib/demat-api';
import { LinkDematRequest, DocumentUpload } from '@/types/demat';
import { useAuthStore } from '@/store/auth-store';
import axios from 'axios';

const linkDematSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .min(1, 'Account number is required')
    .transform((val) => val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    .pipe(
      z.string()
        .length(16, 'Account number must be exactly 16 characters')
        .regex(/^(\d{16}|IN\d{14})$/, 'Must be 16 digits (CDSL) or start with IN followed by 14 digits (NSDL)')
    ),
  dematStatement: z.any().refine((file) => file !== undefined, 'Please upload your CML, CMR, or DP statement document'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

type LinkDematFormData = z.infer<typeof linkDematSchema>;

interface LinkExistingStepProps {
  onNext: (data: any) => void;
  initialData?: any;
  isUpdateMode?: boolean;
  onFormChange?: () => void;
}

export function LinkExistingStep({ onNext, initialData, isUpdateMode = false, onFormChange }: LinkExistingStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedDocument, setUploadedDocument] = useState<any>(null);
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    setError,
    clearErrors,
    watch,
  } = useForm<LinkDematFormData>({
    resolver: zodResolver(linkDematSchema as any),
    defaultValues: {
      accountNumber: isUpdateMode ? '' : (initialData?.accountNumber || user?.dematData?.accountNumber || ''),
      acceptTerms: false,
    },
  });

  // Watch for form changes and notify parent
  const watchedFields = watch();
  useEffect(() => {
    // Notify parent that form has changed when any field updates
    onFormChange?.();
  }, [watchedFields, onFormChange]);

  const uploadFileToStorage = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const storageApiUrl = (process.env.NEXT_PUBLIC_STORAGE_API_URL || '').replace(/\/$/, '');
    
    const endpoint = storageApiUrl
      ? (storageApiUrl.endsWith('/api')
          ? `${storageApiUrl}/upload/demat-documents/demat`
          : `${storageApiUrl}/api/upload/demat-documents/demat`)
      : '/api/upload/demat-documents/demat';

    try {
      const response = await axios.post(endpoint, formData, {
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setUploadProgress(percentComplete);
          }
        }
      });
      
      const result = response.data;
      return {
        fileUrl: result.url,
        fileName: result.fileName,
        fileSize: result.size,
      };
    } catch (error) {
      console.error("Upload error:", error);
      throw new Error('Failed to upload document');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onFormChange?.();

    // Check file size (5MB max)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError('dematStatement', {
        type: 'manual',
        message: `File size exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB). Please choose a smaller file.`,
      });
      setSelectedFile(null);
      setUploadedDocument(null);
      setValue('dematStatement', undefined as any, { shouldValidate: true });
      e.target.value = '';
      return;
    }

    // Check file format: Only PDF, JPG, JPEG, and PNG allowed (SVG explicitly disallowed)
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isSvg = file.type.includes('svg') || fileExt === 'svg';
    const isExtensionAllowed = allowedExtensions.includes(fileExt);
    const isMimeAllowed =
      allowedMimeTypes.includes(file.type.toLowerCase()) || (file.type === '' && isExtensionAllowed);

    if (isSvg || !isExtensionAllowed || !isMimeAllowed) {
      setError('dematStatement', {
        type: 'manual',
        message: 'Invalid file format. Only PDF, JPG, and PNG files are allowed (SVG is not supported).',
      });
      setSelectedFile(null);
      setUploadedDocument(null);
      setValue('dematStatement', undefined as any, { shouldValidate: true });
      e.target.value = '';
      return;
    }

    // Valid file: clear any error and initiate upload
    clearErrors('dematStatement');
    setSelectedFile(file);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedDocument(null);

    try {
      const doc = await uploadFileToStorage(file);
      setUploadedDocument(doc);
      setValue('dematStatement', doc as any, { shouldValidate: true });
      clearErrors('dematStatement');
    } catch (err: any) {
      console.error(err);
      setSelectedFile(null);
      setUploadedDocument(null);
      setValue('dematStatement', undefined as any, { shouldValidate: true });
      setError('dematStatement', {
        type: 'manual',
        message: err?.message || 'Failed to upload document. Please try again.',
      });
      e.target.value = '';
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: LinkDematFormData) => {
    if (!uploadedDocument) {
      setError('dematStatement', {
        type: 'manual',
        message: 'Please upload your CML, CMR, or DP statement document.',
      });
      return;
    }

    try {
      setIsLoading(true);

      const linkRequest: LinkDematRequest = {
        accountNumber: data.accountNumber.trim().toUpperCase(),
        dematStatement: uploadedDocument,
      };

      const response = await linkDemat(linkRequest);

      // toast removed
      onNext(response.data);
    } catch (error: any) {
      console.error(error);
      const apiMessage = error?.response?.data?.message || error?.message || 'Failed to link Demat account. Please verify details and try again.';
      setError('root', {
        type: 'manual',
        message: apiMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-xl sm:rounded-2xl overflow-hidden">
      <CardContent className="p-4 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-7">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="accountNumber" className="text-xs sm:text-sm font-semibold text-slate-700">
              Account Number (BO ID) <span className="text-green-600">*</span>
            </Label>
            <Input
              id="accountNumber"
              placeholder="e.g. 1234567890123456 or IN123456..."
              maxLength={16}
              className="h-10 sm:h-12 rounded-lg sm:rounded-xl border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 transition-colors focus-visible:ring-1 focus-visible:ring-green-600 focus-visible:border-green-600 text-sm sm:text-base uppercase"
              {...register('accountNumber', {
                onChange: (e) => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  setValue('accountNumber', cleaned, { shouldValidate: true });
                },
              })}
            />
            {errors.accountNumber && (
              <p className="text-xs sm:text-sm text-red-500 font-medium">{errors.accountNumber.message}</p>
            )}
            <p className="text-[11px] sm:text-xs text-slate-500">
              Your 16-digit Beneficial Owner ID (BO ID). For CDSL, enter 16 digits. For NSDL, start with &apos;IN&apos;.
            </p>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="dematStatement" className="text-xs sm:text-sm font-semibold text-slate-700">
              CML / CMR / DP Statement <span className="text-green-600">*</span>
            </Label>
            
            <div className={`relative group rounded-lg sm:rounded-xl border-2 border-dashed ${errors.dematStatement ? 'border-red-300 bg-red-50/20' : 'border-slate-200 hover:border-green-500/50 bg-slate-50/50 hover:bg-green-50/30'} transition-all p-4 sm:p-6 text-center cursor-pointer`}>
              <Input
                id="dematStatement"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {!selectedFile ? (
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 pointer-events-none">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-slate-100 flex items-center justify-center mb-0.5 sm:mb-1 group-hover:bg-green-100 transition-colors">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 group-hover:text-green-600 transition-colors" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 group-hover:text-green-700">Click to upload or drag and drop</p>
                  <p className="text-[11px] sm:text-xs text-slate-500">PDF, PNG or JPG (max. 5MB)</p>
                </div>
              ) : isUploading ? (
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 pointer-events-none w-full px-4 sm:px-8">
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 animate-spin mb-0.5 sm:mb-1" />
                  <p className="text-xs sm:text-sm font-semibold text-green-700 truncate max-w-full">Uploading {selectedFile.name}...</p>
                  <div className="w-full bg-green-100 rounded-full h-1.5 sm:h-2 mt-1 sm:mt-2">
                    <div className="bg-green-600 h-1.5 sm:h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p className="text-[11px] sm:text-xs text-green-600 mt-0.5 sm:mt-1">{uploadProgress}% complete</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 pointer-events-none">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-green-100 flex items-center justify-center mb-0.5 sm:mb-1">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-green-700 px-2 sm:px-4 line-clamp-1">{selectedFile.name} (Ready)</p>
                  <p className="text-[11px] sm:text-xs text-green-600/70">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Click to replace</p>
                </div>
              )}
            </div>
            {errors.dematStatement && (
              <p className="text-xs sm:text-sm text-red-500 font-medium">{errors.dematStatement.message as string}</p>
            )}
            <p className="text-[11px] sm:text-xs text-slate-500">
              Upload CML, CMR or DP statement (PDF, JPEG, or PNG, max 5MB)
            </p>
          </div>

          <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
            <div className="flex items-start space-x-2.5 sm:space-x-3">
              <Controller
                control={control}
                name="acceptTerms"
                render={({ field }) => (
                  <Checkbox
                    id="acceptTerms"
                    className="mt-0.5 sm:mt-1 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label
                htmlFor="acceptTerms"
                className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal cursor-pointer"
              >
                I confirm that the provided demat information is correct. I accept full responsibility for any discrepancies, and the company shall not be held liable for resulting issues.
              </Label>
            </div>
            {errors.acceptTerms && (
              <p className="text-xs sm:text-sm text-red-500 font-medium pl-7 sm:pl-8">{errors.acceptTerms.message}</p>
            )}
          </div>

          {errors.root && (
            <div className="p-3 sm:p-3.5 rounded-lg sm:rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
              {errors.root.message}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-10 sm:h-12 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold shadow-[0_4px_14px_0_rgb(22,163,74,0.39)] hover:shadow-[0_6px_20px_rgba(22,163,74,0.23)] hover:-translate-y-[1px] bg-green-600 hover:bg-green-500 text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-none" 
            disabled={isLoading || isUploading || (selectedFile && !uploadedDocument) ? true : false}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                Submitting...
              </>
            ) : isUploading ? (
               <>
                <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              'Submit for Verification'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
