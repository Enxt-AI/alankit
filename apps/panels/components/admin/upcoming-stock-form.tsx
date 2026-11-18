'use client';

import { useEffect } from 'react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notify } from '@/components/ui/floating-notification';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { ImageUpload } from '@/components/ui/image-upload';
import { VersionHistoryDialog } from '@/components/admin/version-history-dialog';
import { RollbackConfirmationDialog } from '@/components/admin/rollback-confirmation-dialog';
import {
  useConvertUpcomingStock,
  useCreateUpcomingStock,
  useUpdateUpcomingStock,
} from '@/hooks/use-admin-upcoming-stocks';
import { useRollbackVersion } from '@/hooks/use-versions';
import type { UpcomingStock } from '@/types/stock';
import { ConvertConfirmationDialog } from '@/components/cms/upcoming-stock-details/convert-confirmation-dialog';
import { getStorageUrl } from '@/lib/utils';
import {
  createUpcomingStockSchema,
  updateUpcomingStockSchema,
  type CreateUpcomingStockFormValues,
  type UpdateUpcomingStockFormValues,
} from '@/lib/validations/upcoming-stock-schema';

type UpcomingStockFormProps = {
  mode: 'create' | 'edit';
  stock?: UpcomingStock;
  isOpen: boolean;
  onCloseAction: () => void;
  onSuccessAction?: () => void;
  useCmsEndpoint?: boolean;
  enableConvert?: boolean;
  onConvertedAction?: (newStockId: string) => void;
};

function extractNewStockId(result: any): string | null {
  if (!result) return null;
  if (typeof result.newStockId === 'string' && result.newStockId.length > 0) return result.newStockId;
  if (typeof result?.data?.newStockId === 'string' && result.data.newStockId.length > 0) return result.data.newStockId;
  if (
    typeof result?.data?.data?.newStockId === 'string' &&
    result.data.data.newStockId.length > 0
  ) {
    return result.data.data.newStockId;
  }
  return null;
}

export function UpcomingStockForm({
  mode,
  stock,
  isOpen,
  onCloseAction,
  onSuccessAction,
  useCmsEndpoint,
  enableConvert,
  onConvertedAction,
}: UpcomingStockFormProps) {
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [rollbackVersion, setRollbackVersion] = React.useState<number | null>(null);
  const [showConvertConfirmation, setShowConvertConfirmation] = React.useState(false);

  const rollbackMutation = useRollbackVersion(useCmsEndpoint);
  const schema = mode === 'edit' ? updateUpcomingStockSchema : createUpcomingStockSchema;

  const form = useForm<CreateUpcomingStockFormValues | UpdateUpcomingStockFormValues>({
    resolver: zodResolver(schema as any),
    defaultValues:
      mode === 'edit' && stock
        ? {
            name: stock.name,
            price: stock.price,
            logoUrl: getStorageUrl(stock.logoUrl),
            cin: stock.cin,
            isin: stock.isin || '',
            isActive: stock.isActive,
          }
        : {
            name: '',
            price: undefined,
            logoUrl: '',
            cin: '',
            isin: '',
            isActive: true,
          },
    mode: 'onChange',
  });

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && stock) {
      form.reset({
        name: stock.name,
        price: stock.price,
        logoUrl: getStorageUrl(stock.logoUrl),
        cin: stock.cin,
        isin: stock.isin || '',
        isActive: stock.isActive,
      });
    } else {
      form.reset({
        name: '',
        price: 0,
        logoUrl: '',
        cin: '',
        isin: '',
        isActive: true,
      });
    }
  }, [isOpen, mode, stock, form]);

  const createMutation = useCreateUpcomingStock(useCmsEndpoint);
  const updateMutation = useUpdateUpcomingStock(useCmsEndpoint);
  const convertMutation = useConvertUpcomingStock(useCmsEndpoint);

  const onSubmit = async (values: CreateUpcomingStockFormValues | UpdateUpcomingStockFormValues) => {
    try {
      const normalizedValues = { ...values };
      if (!normalizedValues.isin || normalizedValues.isin.trim() === '') {
        normalizedValues.isin = undefined;
      }
      if (normalizedValues.logoUrl) {
        normalizedValues.logoUrl = getStorageUrl(normalizedValues.logoUrl);
      }

      if (mode === 'edit' && stock) {
        const updateResult: any = await updateMutation.mutateAsync({
          id: stock.id,
          dto: normalizedValues as UpdateUpcomingStockFormValues,
        });
        notify.success(useCmsEndpoint ? (updateResult?.message || 'Upcoming stock update submitted for admin approval. It will go live after approval.') : 'Upcoming stock updated successfully');
      } else {
        const createResult: any = await createMutation.mutateAsync(normalizedValues as CreateUpcomingStockFormValues);
        notify.success(useCmsEndpoint ? (createResult?.message || 'Upcoming stock creation submitted for admin approval. It will go live after approval.') : 'Upcoming stock created successfully');
      }

      onCloseAction();
      onSuccessAction?.();
    } catch (error: any) {
      notify.error(error.message || 'Failed to save upcoming stock');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isConverting = convertMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onCloseAction}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden gap-0 bg-white">
          <DialogHeader className="px-6 py-6 border-b bg-slate-50/50">
            <DialogTitle className="text-xl font-semibold text-slate-800">
              {mode === 'edit' ? 'Edit Upcoming Stock' : 'Create New Upcoming Stock'}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-slate-500">
              {mode === 'edit'
                ? 'Update the editable upcoming stock details below. Stock name and CIN cannot be changed.'
                : 'Fill in the details to create a new upcoming stock. CIN is required and becomes immutable.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh] overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-emerald-500 rounded-full"></div>
                    Basic Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Stock Name */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel className="text-slate-700 font-medium">Stock Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500" placeholder="e.g., Acme Corporation" disabled={mode === 'edit'} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Stock Price */}
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Price <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === '' ? undefined : parseFloat(value));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />



                    {/* Logo URL */}
                    <FormField
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Logo</FormLabel>
                          <FormControl>
                            <ImageUpload
                              value={field.value || ''}
                              onChange={field.onChange}
                              bucketName="stocks"
                              pathPrefix="logos"
                              useCmsEndpoint={useCmsEndpoint}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Identifiers Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                    Business Identifiers
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-slate-50/80 rounded-xl border border-slate-200/60 shadow-sm">
                    {/* CIN */}
                    <FormField
                      control={form.control}
                      name="cin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">CIN <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 font-mono text-sm uppercase shadow-sm border-slate-200 focus-visible:ring-blue-500"
                              placeholder="U74999MH2019PTC123456"
                              maxLength={21}
                              disabled={mode === 'edit'}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase());
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-slate-500">21-character Corporate ID</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* ISIN */}
                    <FormField
                      control={form.control}
                      name="isin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">ISIN</FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 font-mono text-sm uppercase shadow-sm border-slate-200 focus-visible:ring-blue-500"
                              placeholder="INE002A01018"
                              maxLength={12}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase());
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-slate-500">12-character International ID</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Status & Categorization Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-amber-500 rounded-full"></div>
                    Platform Visibility
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Active Status */}
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer group" onClick={() => field.onChange(!field.value)}>
                          <div className="space-y-1">
                            <FormLabel className="font-semibold text-sm text-slate-800 cursor-pointer pointer-events-none">Active</FormLabel>
                            <p className="text-[11px] text-slate-500 leading-tight">Visible to all users on the platform.</p>
                          </div>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 scale-110" onClick={(e) => e.stopPropagation()} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              </div>

              <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                <div className="flex w-full justify-between items-center sm:flex-row flex-col gap-4 sm:gap-0">
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-start">
                    {mode === 'edit' && stock?.id && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium"
                          onClick={() => setShowVersionHistory(true)}
                          disabled={isLoading || isConverting}
                        >
                          View History
                        </Button>
                        {enableConvert && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setShowConvertConfirmation(true)}
                            disabled={isLoading || isConverting}
                            className="font-medium"
                          >
                            {isConverting ? 'Converting...' : 'Convert to Regular Stock'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                    <Button type="button" variant="outline" onClick={onCloseAction} disabled={isLoading || isConverting} className="h-10 px-6 font-medium border-slate-300 text-slate-700 hover:bg-slate-100 w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading || isConverting} className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shadow-sm hover:shadow-md w-full sm:w-auto">
                      {isLoading ? 'Saving...' : mode === 'edit' ? 'Update Upcoming Stock' : 'Create Upcoming Stock'}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {mode === 'edit' && stock?.id && enableConvert && (
        <ConvertConfirmationDialog
          isOpen={showConvertConfirmation}
          onClose={() => setShowConvertConfirmation(false)}
          isLoading={isConverting}
          onConfirm={async () => {
            try {
              const result = await convertMutation.mutateAsync(stock.id);
              const newStockId = extractNewStockId(result);
              if (!newStockId) {
                notify.error('Conversion succeeded but new stock id is missing.');
                return;
              }

              setShowConvertConfirmation(false);
              onCloseAction();
              onConvertedAction?.(newStockId);
            } catch {
              // Error toasts are handled by the mutation hook.
            }
          }}
        />
      )}

      {mode === 'edit' && stock?.id && (
        <>
          <VersionHistoryDialog
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            entityType="UPCOMING_STOCK"
            entityId={stock.id}
            entityName={`${stock.name} (${stock.cin})`}
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
                entityType: 'UPCOMING_STOCK',
                entityId: stock.id,
                versionNumber: rollbackVersion!,
              });
              setRollbackVersion(null);
              setShowVersionHistory(false);
              onCloseAction();
              onSuccessAction?.();
            }}
            entityName={`${stock.name} (${stock.cin})`}
          />
        </>
      )}
    </>
  );
}
