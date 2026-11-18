'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, Upload, X, FileText, CheckCircle2, Check, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createTicketSchema, CreateTicketFormValues } from '@/lib/validations/ticket-schema';
import { useCreateTicket } from '@/hooks/use-tickets';
import { useAuthStore } from '@/store/auth-store';
import { CreateTicketDto } from '@/lib/ticketing-api';

interface TicketFormProps {
  onSuccess?: () => void;
}

export function TicketForm({ onSuccess }: TicketFormProps) {
  const { user } = useAuthStore();
  const createTicketMutation = useCreateTicket();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  const [stagingProgress, setStagingProgress] = useState(0);
  const [stagingFileName, setStagingFileName] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [submittedTicketTitle, setSubmittedTicketTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleFiles = (incomingFiles: File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf'
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles: File[] = [];
    let err: string | null = null;

    for (const file of incomingFiles) {
      if (!allowedTypes.includes(file.type)) {
        err = 'Unsupported file format. Please upload Images (JPEG, PNG, WEBP) or PDFs.';
        continue;
      }
      if (file.size > maxSize) {
        err = `File "${file.name}" exceeds the 10MB limit.`;
        continue;
      }
      validFiles.push(file);
    }

    if (err && validFiles.length === 0) {
      setError(err);
      return;
    }

    const availableSlots = 5 - selectedFiles.length;
    if (availableSlots <= 0) {
      setError('Maximum 5 files allowed.');
      return;
    }

    const filesToAdd = validFiles.slice(0, availableSlots);
    if (validFiles.length > availableSlots) {
      setError(`Only ${availableSlots} more file(s) could be added (max 5 total).`);
    } else {
      setError(null);
    }

    if (filesToAdd.length === 0) return;

    // Trigger smooth uploading animation
    setIsStaging(true);
    setStagingProgress(20);
    setStagingFileName(filesToAdd.length === 1 ? (filesToAdd[0]?.name ?? 'file') : `${filesToAdd.length} files`);

    const interval = setInterval(() => {
      setStagingProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          setTimeout(() => {
            setSelectedFiles((current) => [...current, ...filesToAdd]);
            setIsStaging(false);
            setStagingProgress(0);
            setStagingFileName('');
          }, 180);
          return 100;
        }
        return prev + Math.floor(Math.random() * 25) + 15;
      });
    }, 100);
  };

  const form = useForm<CreateTicketFormValues>({
    resolver: zodResolver(createTicketSchema as any),
    defaultValues: {
      title: '',
      description: '',
      labels: [],
    },
  });

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setUploadProgress(null);
      abortControllerRef.current = null;
    }
  };

  const onSubmit = async (values: CreateTicketFormValues) => {
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let payload: CreateTicketDto | FormData;

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append('title', values.title);
        formData.append('description', values.description);
        formData.append('createdBy', user.id);
        if (values.category) formData.append('category', values.category);
        if (values.priority) formData.append('priority', values.priority);
        if (values.labels && Array.isArray(values.labels)) {
          values.labels.forEach(label => formData.append('labels', label));
        }
        selectedFiles.forEach(file => formData.append('files', file));
        payload = formData;
      } else {
        payload = {
          ...values,
          createdBy: user.id,
        };
      }

      setUploadProgress(selectedFiles.length > 0 ? 0 : null);

      const createdTicket = await createTicketMutation.mutateAsync({
        payload,
        onUploadProgress: (progressEvent) => {
          if (selectedFiles.length === 0) return;
          const total = progressEvent.total || progressEvent.loaded;
          const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
          setUploadProgress(percentCompleted);
        },
        signal: controller.signal,
      });

      const ticketId = (createdTicket as any)?.id || (createdTicket as any)?.data?.id || null;
      setSubmittedTicketId(ticketId);
      setSubmittedTicketTitle(values.title);
      setIsSuccess(true);
      setShowSuccessModal(true);

      form.reset();
      setSelectedFiles([]);
    } catch (err: any) {
      if (err?.message === 'Upload cancelled') {
        console.log('Upload was cancelled by the user.');
      } else {
        console.error('Failed to create ticket:', err);
        setError(err?.message || 'Failed to create ticket. Please try again.');
      }
    } finally {
      setUploadProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => {
      setIsSuccess(false);
      setSubmittedTicketId(null);
      setSubmittedTicketTitle('');
    }, 5000);
    onSuccess?.();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5 relative">
        {/* Minimal Top Loading Accent Bar */}
        {createTicketMutation.isPending && (
          <div className="absolute -top-3.5 -left-3.5 -right-3.5 sm:-top-6 sm:-left-6 sm:-right-6 h-[2.5px] bg-emerald-100/70 overflow-hidden rounded-t-2xl animate-in fade-in duration-200 pointer-events-none">
            <div className="h-full w-1/3 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-full animate-progress-flow" />
          </div>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="space-y-1 sm:space-y-1.5">
              <FormLabel className="text-xs sm:text-sm font-semibold text-slate-700">Title</FormLabel>
              <FormControl>
                <Input
                  disabled={createTicketMutation.isPending || isSuccess}
                  placeholder="Brief description of your issue"
                  className="rounded-xl h-10 sm:h-11 text-xs sm:text-sm bg-slate-50/80 border-slate-200 focus-visible:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[11px]" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="space-y-1 sm:space-y-1.5">
              <FormLabel className="text-xs sm:text-sm font-semibold text-slate-700">Description</FormLabel>
              <FormControl>
                <Textarea
                  disabled={createTicketMutation.isPending || isSuccess}
                  placeholder="Provide detailed information about your issue..."
                  className="min-h-[100px] sm:min-h-[120px] text-xs sm:text-sm rounded-xl bg-slate-50/80 border-slate-200 focus-visible:bg-white resize-none disabled:opacity-75 disabled:cursor-not-allowed"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[11px]" />
            </FormItem>
          )}
        />

        {/* File Attachments */}
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-xs sm:text-sm font-semibold text-slate-700">Attachments (Optional)</label>
          <div className="space-y-2">
            {/* Active Uploading Animation State */}
            {isStaging || uploadProgress !== null ? (
              <div className="border-2 border-emerald-500 bg-emerald-50/50 rounded-xl p-4 sm:p-5 text-center relative overflow-hidden transition-all duration-300 shadow-xs">
                {/* Background ambient glow */}
                <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-teal-400/20 rounded-full blur-xl pointer-events-none" />

                {/* Animated ripple badge */}
                <div className="relative mx-auto mb-2.5 h-12 w-12 flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-30" />
                  <div className="relative h-10 w-10 rounded-full bg-emerald-100 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs">
                    <Upload className="h-5 w-5 animate-bounce" />
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-bold text-emerald-900">
                  {uploadProgress !== null ? 'Uploading attachments...' : 'Processing & uploading file...'}
                </p>
                <p className="text-[10px] sm:text-xs text-emerald-700/80 mt-0.5 truncate max-w-xs mx-auto">
                  {uploadProgress !== null
                    ? `${selectedFiles.length} file(s) uploading to server`
                    : stagingFileName}
                </p>

                {/* Animated Progress Bar */}
                <div className="w-full max-w-xs mx-auto space-y-1.5 mt-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                      <span>{uploadProgress !== null ? 'Uploading' : 'Preparing'}</span>
                    </span>
                    <span className="tabular-nums font-bold text-emerald-900">
                      {uploadProgress ?? stagingProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-emerald-100/90 h-2 rounded-full overflow-hidden p-0.5 border border-emerald-200/60">
                    <div
                      className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 h-full rounded-full transition-all duration-200 shadow-xs relative"
                      style={{ width: `${uploadProgress ?? stagingProgress}%` }}
                    />
                  </div>
                </div>

                {uploadProgress !== null && (
                  <div className="mt-2.5 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelUpload}
                      className="text-[11px] font-semibold h-6 text-red-600 hover:text-red-700 hover:bg-red-50/80 rounded-lg px-2.5"
                    >
                      Cancel Upload
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* Idle / Drag State */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    handleFiles(Array.from(e.dataTransfer.files));
                  }
                }}
                onClick={() => document.getElementById('file-upload')?.click()}
                className={`border-2 border-dashed rounded-xl p-3.5 sm:p-5 text-center cursor-pointer transition-all duration-200 group ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01] ring-4 ring-emerald-500/15 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30'
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-1.5 transition-all duration-200 ${
                    isDragging
                      ? 'bg-emerald-100 text-emerald-600 scale-110'
                      : 'bg-slate-100 group-hover:bg-emerald-100/80 text-slate-400 group-hover:text-emerald-600 group-hover:-translate-y-0.5'
                  }`}
                >
                  <Upload className={`h-5 w-5 ${isDragging ? 'animate-bounce' : 'transition-transform'}`} />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">
                  {isDragging ? 'Drop files here to upload' : 'Click to upload files or drag and drop'}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-0.5 transition-colors">
                  Max 5 files, 10MB each. Supported: Images, PDFs
                </p>
              </div>
            )}

            <input
              id="file-upload"
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                handleFiles(files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">
                  Selected Files ({selectedFiles.length}/5):
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                  className="text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold h-7 px-2 rounded-lg"
                >
                  Discard All
                </Button>
              </div>
              <div className="space-y-1.5">
                {selectedFiles.map((file, index) => {
                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:border-slate-300 transition-all animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isPdf ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Ready
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))}
                          className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-400 shrink-0 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mt-3 py-2 px-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {isSuccess && (
          <div className="p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-2xs">
            <div className="h-5 w-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
            </div>
            <p className="flex-1">
              Your support request has been submitted successfully! We will follow up shortly.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 pt-2">
          <p className="text-[11px] sm:text-xs text-slate-400">
            Confirmation will be sent to your registered email.
          </p>
          <Button
            type="submit"
            disabled={createTicketMutation.isPending || isSuccess}
            className={`group relative overflow-hidden rounded-xl h-10 sm:h-11 px-5 text-xs sm:text-sm font-semibold transition-all duration-300 min-w-[140px] shadow-xs active:scale-[0.98] ${
              isSuccess
                ? 'bg-emerald-600 hover:bg-emerald-600 text-white ring-2 ring-emerald-400/40 cursor-default'
                : createTicketMutation.isPending
                ? 'bg-emerald-600 text-white cursor-wait opacity-95'
                : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-md hover:shadow-green-600/15'
            }`}
          >
            {/* Specular shimmer sweep during submission */}
            {createTicketMutation.isPending && (
              <span className="absolute inset-0 -translate-x-full animate-submit-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
            )}

            {isSuccess ? (
              <span className="inline-flex items-center gap-1.5 animate-in zoom-in-95 duration-200">
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>Ticket Raised!</span>
              </span>
            ) : createTicketMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-white/90" />
                <span>
                  {uploadProgress !== null && uploadProgress > 0 && uploadProgress < 100
                    ? `Uploading (${uploadProgress}%)...`
                    : 'Submitting...'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span>Raise Ticket</span>
                <Send className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-green-100" />
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Ticket Raised Confirmation Pop-up Modal */}
      <Dialog
        open={showSuccessModal}
        onOpenChange={(open) => {
          if (!open) handleCloseSuccessModal();
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-6 sm:p-7 bg-white border border-slate-200/90 shadow-2xl text-center overflow-hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            {/* Animated Celebration Icon with Radar Ring */}
            <div className="relative flex items-center justify-center my-1.5">
              <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-emerald-400 opacity-25" />
              <div className="relative h-14 w-14 rounded-full bg-emerald-100 border border-emerald-200/90 flex items-center justify-center text-emerald-600 shadow-xs animate-in zoom-in-75 duration-300">
                <Check className="h-7 w-7 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1.5 text-center">
              <DialogTitle className="text-lg sm:text-xl font-bold text-[#1A2530]">
                Ticket Raised Successfully!
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                Your support request has been registered. Our dedicated support team will review your query and follow up on your registered email.
              </DialogDescription>
            </div>

            {submittedTicketTitle && (
              <div className="w-full bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 text-left space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</span>
                <p className="text-xs font-semibold text-slate-800 truncate">{submittedTicketTitle}</p>
                {submittedTicketId && (
                  <p className="text-[10px] font-mono text-emerald-700 font-medium pt-0.5">
                    Ticket Ref: <span className="font-bold">#{submittedTicketId.slice(-8).toUpperCase()}</span>
                  </p>
                )}
              </div>
            )}

            <div className="w-full pt-2">
              <Button
                type="button"
                onClick={handleCloseSuccessModal}
                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl h-11 font-bold shadow-xs transition-all active:scale-[0.98]"
              >
                Got It
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}