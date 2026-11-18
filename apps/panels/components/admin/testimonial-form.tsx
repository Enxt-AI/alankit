'use client';

import { useEffect } from 'react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { VersionHistoryDialog } from '@/components/admin/version-history-dialog';
import { RollbackConfirmationDialog } from '@/components/admin/rollback-confirmation-dialog';
import { Loader2 } from 'lucide-react';
import { Testimonial } from '@/types/testimonial';
import {
  createTestimonialSchema,
  updateTestimonialSchema,
  type CreateTestimonialFormValues,
  type UpdateTestimonialFormValues,
} from '@/lib/validations/testimonial-schema';
import {
  useCreateTestimonial,
  useUpdateTestimonial,
} from '@/hooks/use-testimonials';
import { useRollbackVersion } from '@/hooks/use-versions';

/**
 * Props for the TestimonialForm dialog component.
 *
 * @param mode            - 'create' for a new testimonial, 'edit' for updating an existing one.
 * @param testimonial     - The testimonial to edit (only required in 'edit' mode).
 * @param isOpen          - Whether the dialog is visible.
 * @param onClose         - Callback to close the dialog.
 * @param onSuccess       - Callback fired after a successful create or update.
 * @param useCmsEndpoint  - When true, mutations go through the CMS endpoint instead of Admin.
 */
interface TestimonialFormProps {
  mode: 'create' | 'edit';
  testimonial?: Testimonial;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  useCmsEndpoint?: boolean;
}

export function TestimonialForm({
  mode,
  testimonial,
  isOpen,
  onClose,
  onSuccess,
  useCmsEndpoint,
}: TestimonialFormProps) {
  // ---------------------------------------------------------------------------
  // Version history state (edit mode only)
  // ---------------------------------------------------------------------------
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [rollbackVersion, setRollbackVersion] = React.useState<number | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const rollbackMutation = useRollbackVersion(useCmsEndpoint);
  const createMutation = useCreateTestimonial(useCmsEndpoint);
  const updateMutation = useUpdateTestimonial(useCmsEndpoint);
  const isLoading = createMutation.isPending || updateMutation.isPending;

  // ---------------------------------------------------------------------------
  // Form setup
  // ---------------------------------------------------------------------------
  const schema =
    mode === 'create' ? createTestimonialSchema : updateTestimonialSchema;

  const form = useForm<
    CreateTestimonialFormValues | UpdateTestimonialFormValues
  >({
    resolver: zodResolver(schema as any),
    defaultValues: {
      name: '',
      designation: '',
      company: '',
      feedback: '',
      isActive: true,
    },
  });

  // Reset form values whenever the dialog opens or the testimonial changes
  useEffect(() => {
    if (mode === 'edit' && testimonial) {
      form.reset({
        name: testimonial.name,
        designation: testimonial.designation,
        company: testimonial.company,
        feedback: testimonial.feedback,
        isActive: testimonial.isActive,
      });
    } else if (mode === 'create') {
      form.reset({
        name: '',
        designation: '',
        company: '',
        feedback: '',
        isActive: true,
      });
    }
  }, [mode, testimonial, form]);

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const onSubmit = async (
    values: CreateTestimonialFormValues | UpdateTestimonialFormValues,
  ) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(
          values as CreateTestimonialFormValues,
        );
      } else if (mode === 'edit' && testimonial) {
        await updateMutation.mutateAsync({
          id: testimonial.id,
          dto: values as UpdateTestimonialFormValues,
        });
      }
      onSuccess();
      onClose();
    } catch {
      // Error is handled by the mutation's onError callback (toast)
    }
  };

  // Generate dialog titles based on mode
  const dialogTitle =
    mode === 'create' ? 'Create New Testimonial' : 'Edit Testimonial';
  const dialogDescription =
    mode === 'create'
      ? 'Fill in the details to add a new client testimonial.'
      : 'Update the details of this client testimonial.';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden gap-0 bg-white">
          <DialogHeader className="px-6 py-6 border-b bg-slate-50/50">
            <DialogTitle className="text-xl font-semibold text-slate-800">
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-slate-500">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

                {/* Author Details Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-emerald-500 rounded-full"></div>
                    Author Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Name -- full name of the testimonial author */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel className="text-slate-700 font-medium">Full Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              placeholder="e.g., Sarah Johnson"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Designation -- job title / role */}
                    <FormField
                      control={form.control}
                      name="designation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Designation <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              placeholder="e.g., CEO"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Company -- organisation name */}
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Company <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              placeholder="e.g., TechStart Inc."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Testimonial Content Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                    Testimonial Content
                  </h3>

                  <div className="grid grid-cols-1 gap-5">
                    {/* Feedback -- the testimonial quote */}
                    <FormField
                      control={form.control}
                      name="feedback"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Feedback <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Textarea
                              rows={5}
                              placeholder="Enter the client testimonial / feedback..."
                              className="shadow-sm border-slate-200 focus-visible:ring-blue-500 resize-y min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Platform Visibility Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-amber-500 rounded-full"></div>
                    Platform Visibility
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Active checkbox -- controls public visibility */}
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem
                          className="flex flex-row items-center justify-between space-y-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer group"
                          onClick={() => field.onChange(!field.value)}
                        >
                          <div className="space-y-1 pr-4">
                            <FormLabel className="font-semibold text-sm text-slate-800 cursor-pointer pointer-events-none">Active Visibility</FormLabel>
                            <p className="text-[11px] text-slate-500 leading-tight">Controls if this testimonial is visible on the landing page.</p>
                          </div>
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 scale-125"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              </div>

              {/* Action Footer */}
              <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                <div className="flex w-full justify-between items-center sm:flex-row flex-col gap-4 sm:gap-0">
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-start">
                    {/* Version history button (edit mode only) */}
                    {mode === 'edit' && testimonial?.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium"
                        onClick={() => setShowVersionHistory(true)}
                        disabled={isLoading}
                      >
                        View History
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isLoading}
                      className="h-10 px-6 font-medium border-slate-300 text-slate-700 hover:bg-slate-100 w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shadow-sm hover:shadow-md w-full sm:w-auto"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : mode === 'create' ? (
                        'Create Testimonial'
                      ) : (
                        'Update Testimonial'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Version History + Rollback dialogs (edit mode only) */}
      {mode === 'edit' && testimonial?.id && (
        <>
          <VersionHistoryDialog
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            entityType="TESTIMONIAL"
            entityId={testimonial.id}
            entityName={testimonial.name}
            onRollback={(versionNumber) => setRollbackVersion(versionNumber)}
            useCmsEndpoint={useCmsEndpoint}
          />

          <RollbackConfirmationDialog
            isOpen={rollbackVersion !== null}
            onClose={() => setRollbackVersion(null)}
            versionNumber={rollbackVersion!}
            isLoading={rollbackMutation.isPending}
            onConfirm={async () => {
              await rollbackMutation.mutateAsync({
                entityType: 'TESTIMONIAL',
                entityId: testimonial.id,
                versionNumber: rollbackVersion!,
              });
              setRollbackVersion(null);
              setShowVersionHistory(false);
              onClose();
              onSuccess?.();
            }}
            entityName={testimonial.name}
          />
        </>
      )}
    </>
  );
}
