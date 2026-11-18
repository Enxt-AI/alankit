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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Faq } from '@/types/faq';
import { createFaqSchema, updateFaqSchema, CreateFaqFormValues, UpdateFaqFormValues } from '@/lib/validations/faq-schema';
import { useCreateFaq, useUpdateFaq } from '@/hooks/use-admin-faqs';
import { useRollbackVersion } from '@/hooks/use-versions';
import { useAdminStocks } from '@/hooks/use-admin-stocks';

interface FaqFormProps {
  mode: 'create' | 'edit';
  faq?: Faq;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  useCmsEndpoint?: boolean;
}

export function FaqForm({ mode, faq, isOpen, onClose, onSuccess, useCmsEndpoint }: FaqFormProps) {
  // State for version history dialog
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [rollbackVersion, setRollbackVersion] = React.useState<number | null>(null);

  // Fetch stocks for association
  const { data: stocks, isLoading: isLoadingStocks } = useAdminStocks(isOpen, true);

  // Use the rollback hook
  const rollbackMutation = useRollbackVersion(useCmsEndpoint);
  const createMutation = useCreateFaq(useCmsEndpoint);
  const updateMutation = useUpdateFaq(useCmsEndpoint);
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const schema = mode === 'create' ? createFaqSchema : updateFaqSchema;
  const form = useForm<CreateFaqFormValues | UpdateFaqFormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      title: '',
      answer: '',
      category: 'General',
      isActive: true,
      stockId: '',
    },
  });

  useEffect(() => {
    if (mode === 'edit' && faq) {
      form.reset({
        title: faq.title,
        answer: faq.answer,
        category: faq.category,
        isActive: faq.isActive,
        stockId: faq.stockId || '',
      });
    } else if (mode === 'create') {
      form.reset({
        title: '',
        answer: '',
        category: 'General',
        isActive: true,
        stockId: '',
      });
    }
  }, [mode, faq, form]);

  const onSubmit = async (values: CreateFaqFormValues | UpdateFaqFormValues) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(values as CreateFaqFormValues);
      } else if (mode === 'edit' && faq) {
        await updateMutation.mutateAsync({ id: faq.id, dto: values as UpdateFaqFormValues });
      }
      onSuccess();
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Generate dialog titles based on mode
  const dialogTitle = mode === 'create' ? 'Create New FAQ' : 'Edit FAQ Entry';
  const dialogDescription =
    mode === 'create'
      ? 'Fill in the details to create a new frequently asked question.'
      : 'Update the details of this FAQ entry.';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden gap-0 bg-white">
          <DialogHeader className="px-6 py-6 border-b bg-slate-50/50">
            <DialogTitle className="text-xl font-semibold text-slate-800">{dialogTitle}</DialogTitle>
            <DialogDescription className="mt-1.5 text-slate-500">{dialogDescription}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh] overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

                {/* FAQ Details Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-emerald-500 rounded-full"></div>
                    FAQ Details
                  </h3>

                  <div className="grid grid-cols-1 gap-5">
                    {/* Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Question Title <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              placeholder="e.g., How to invest in unlisted stocks?"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Answer */}
                    <FormField
                      control={form.control}
                      name="answer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Answer <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Textarea
                              rows={6}
                              placeholder="Provide a detailed answer to the question..."
                              className="shadow-sm border-slate-200 focus-visible:ring-emerald-500 resize-y min-h-[150px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Categorization Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                    Categorization
                  </h3>

                  <div className="p-5 bg-slate-50/80 rounded-xl border border-slate-200/60 shadow-sm">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-800">FAQ Category</FormLabel>
                          <p className="text-[11px] text-slate-500 mb-3">
                            Choose the category that best fits this FAQ entry.
                          </p>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus-visible:ring-blue-500">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Investing">Investing</SelectItem>
                              <SelectItem value="Support">Support</SelectItem>
                              <SelectItem value="General">General</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Platform Linking & Visibility Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-amber-500 rounded-full"></div>
                    Linking &amp; Visibility
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Stock Association */}
                    <FormField
                      control={form.control}
                      name="stockId"
                      render={({ field }) => (
                        <FormItem className="space-y-3 bg-slate-50/50 p-5 rounded-xl border border-slate-200/60 transition-all hover:bg-slate-50">
                          <div className="flex flex-col mb-1">
                            <FormLabel className="text-sm font-semibold text-slate-800">Associate with Stock (Optional)</FormLabel>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Linking this FAQ to a stock will display it directly on that stock&apos;s detail page.
                            </p>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <Select
                                onValueChange={(val) => field.onChange(val === '_none' ? '' : val)}
                                value={field.value || '_none'}
                              >
                                <SelectTrigger className="bg-white border-slate-200 shadow-sm h-11 transition-all focus:ring-amber-500 text-sm">
                                  <SelectValue placeholder={isLoadingStocks ? 'Loading available stocks...' : 'Select a stock or keep as general...'} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {isLoadingStocks ? (
                                    <div className="flex items-center justify-center p-6 text-slate-500 text-sm gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span>Fetching available stocks...</span>
                                    </div>
                                  ) : (
                                    <>
                                      <SelectItem value="_none" className="text-slate-500 italic">
                                        None / General (Visible on Support &amp; Home)
                                      </SelectItem>
                                      {stocks?.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-xs">No stocks found.</div>
                                      ) : (
                                        stocks?.map((stock) => (
                                          <SelectItem key={stock.id} value={stock.id} className="cursor-pointer py-2">
                                            <div className="flex flex-col space-y-0.5">
                                              <span className="font-semibold text-slate-800 text-sm">{stock.name}</span>
                                              <span className="text-[10px] text-slate-400 font-mono tracking-tighter">CIN: {stock.cin}</span>
                                            </div>
                                          </SelectItem>
                                        ))
                                      )}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Active Visibility */}
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem
                          className="flex flex-row items-center justify-between space-y-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer group self-start"
                          onClick={() => field.onChange(!field.value)}
                        >
                          <div className="space-y-1 pr-4">
                            <FormLabel className="font-semibold text-sm text-slate-800 cursor-pointer pointer-events-none">Active Visibility</FormLabel>
                            <p className="text-[11px] text-slate-500 leading-tight">Controls if this FAQ is visible to users on the platform.</p>
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
                    {mode === 'edit' && faq?.id && (
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
                        'Create FAQ'
                      ) : (
                        'Update FAQ'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      {mode === 'edit' && faq?.id && (
        <>
          <VersionHistoryDialog
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            entityType="FAQ"
            entityId={faq.id}
            entityName={faq.title}
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
                entityType: 'FAQ',
                entityId: faq.id,
                versionNumber: rollbackVersion!
              });
              setRollbackVersion(null);
              setShowVersionHistory(false);
              onClose();
              onSuccess?.();
            }}
            entityName={faq.title}
          />
        </>
      )}
    </>
  );
}