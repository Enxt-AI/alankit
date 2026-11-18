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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ImageUpload } from '@/components/ui/image-upload';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { VersionHistoryDialog } from '@/components/admin/version-history-dialog';
import { RollbackConfirmationDialog } from '@/components/admin/rollback-confirmation-dialog';
import { useCreateStock, useUpdateStock } from '@/hooks/use-admin-stocks';
import { useRollbackVersion } from '@/hooks/use-versions';
import { Stock } from '@/types/stock';
import { getStorageUrl } from '@/lib/utils';
import {
  createStockSchema,
  updateStockSchema,
  type CreateStockFormValues,
  type UpdateStockFormValues,
} from '@/lib/validations/stock-schema';
import { useCompanyDetails } from '@/hooks/use-company-details';
import { useAdminStockCategories } from '@/hooks/use-admin-stock-categories';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StockFormProps = {
  mode: 'create' | 'edit';
  stock?: Stock;
  isOpen: boolean;
  onCloseAction: () => void;
  onSuccessAction?: () => void;
  useCmsEndpoint?: boolean;
};

export function StockForm({ mode, stock, isOpen, onCloseAction, onSuccessAction, useCmsEndpoint }: StockFormProps) {
  // State for version history dialog
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [rollbackVersion, setRollbackVersion] = React.useState<number | null>(null);

  // Fetch probe description so we can offer auto-fill for Company Overview
  const { data: companyDetails } = useCompanyDetails(stock?.cin);

  // Fetch categories
  const { categories, isLoading: isCategoriesLoading } = useAdminStockCategories();

  // Use the rollback hook
  const rollbackMutation = useRollbackVersion(useCmsEndpoint);
  const schema = mode === 'edit' ? updateStockSchema : createStockSchema;
  
  const form = useForm<CreateStockFormValues | UpdateStockFormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: mode === 'edit' && stock
      ? {
          name: stock.name,
          price: stock.price,
          minimumPurchaseQuantity: stock.minimumPurchaseQuantity ?? undefined,
          maximumPurchaseQuantity: stock.maximumPurchaseQuantity ?? undefined,
          logoUrl: getStorageUrl(stock.logoUrl),
          cin: stock.cin || '',
          slug: stock.slug || '',
          isin: stock.isin || '',
          pan: stock.pan || '',
          companyOverview: stock.companyOverview || stock.description || '',
          isActive: stock.isActive,
          isPopular: stock.isPopular ?? false,
          isMarketMover: stock.isMarketMover ?? false,
          categoryId: stock.categoryId || '',
        }
      : {
          name: '',
          price: undefined,
          minimumPurchaseQuantity: undefined,
          maximumPurchaseQuantity: undefined,
          logoUrl: '',
          cin: '',
          slug: '',
          isin: '',
          pan: '',
          companyOverview: '',
          isActive: true,
          isPopular: false,
          isMarketMover: false,
          categoryId: '',
        },
    mode: 'onChange',
  });

  // Reset form when dialog opens/closes or stock changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && stock) {
        form.reset({
          name: stock.name,
          price: stock.price,
          minimumPurchaseQuantity: stock.minimumPurchaseQuantity ?? undefined,
          maximumPurchaseQuantity: stock.maximumPurchaseQuantity ?? undefined,
          logoUrl: getStorageUrl(stock.logoUrl),
          cin: stock.cin || '',
          slug: stock.slug || '',
          isin: stock.isin || '',
          pan: stock.pan || '',
          companyOverview: stock.companyOverview || stock.description || '',
          isActive: stock.isActive,
          isPopular: stock.isPopular ?? false,
          isMarketMover: stock.isMarketMover ?? false,
          categoryId: stock.categoryId || '',
        });
      } else {
        form.reset({
          name: '',
          price: undefined,
          minimumPurchaseQuantity: undefined,
          maximumPurchaseQuantity: undefined,
          logoUrl: '',
          cin: '',
          slug: '',
          isin: '',
          pan: '',
          companyOverview: '',
          isActive: true,
          isPopular: false,
          isMarketMover: false,
          categoryId: '',
        });
      }
    }
  }, [isOpen, mode, stock, form]);



  const createMutation = useCreateStock(useCmsEndpoint);
  const updateMutation = useUpdateStock(useCmsEndpoint);

  const onSubmit = async (values: CreateStockFormValues | UpdateStockFormValues) => {
    try {
      const sanitizedValues = { ...values };
      if (sanitizedValues.logoUrl) {
        sanitizedValues.logoUrl = getStorageUrl(sanitizedValues.logoUrl);
      }

      if (mode === 'edit' && stock) {
        const updatePayload: any = { ...sanitizedValues };
        // Strip unchanged disabled/immutable fields to avoid triggering server-side permission or immutability blocks
        if (updatePayload.name === stock.name) {
          delete updatePayload.name;
        }
        if (updatePayload.cin === stock.cin) {
          delete updatePayload.cin;
        }

        // When left empty or cleared, explicitly send null so backend/Prisma resets it to NULL (no limit)
        updatePayload.maximumPurchaseQuantity = (updatePayload.maximumPurchaseQuantity !== undefined && updatePayload.maximumPurchaseQuantity !== null && updatePayload.maximumPurchaseQuantity !== '')
          ? Number(updatePayload.maximumPurchaseQuantity)
          : null;

        updatePayload.minimumPurchaseQuantity = (updatePayload.minimumPurchaseQuantity !== undefined && updatePayload.minimumPurchaseQuantity !== null && updatePayload.minimumPurchaseQuantity !== '')
          ? Number(updatePayload.minimumPurchaseQuantity)
          : null;

        const updateResult: any = await updateMutation.mutateAsync({
          id: stock.id,
          dto: updatePayload as UpdateStockFormValues,
        });
        notify.success(useCmsEndpoint ? (updateResult?.message || 'Stock update submitted for admin approval. It will go live after approval.') : 'Stock updated successfully');
      } else {
        const createResult: any = await createMutation.mutateAsync(sanitizedValues as CreateStockFormValues);
        notify.success(useCmsEndpoint ? (createResult?.message || 'Stock creation submitted for admin approval. It will go live after approval.') : 'Stock created successfully');
      }

      onCloseAction();
      onSuccessAction?.();
    } catch (error: any) {
      notify.error(error.message || 'Failed to save stock');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onCloseAction}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden gap-0 bg-white">
          <DialogHeader className="px-6 py-6 border-b bg-slate-50/50">
            <DialogTitle className="text-xl font-semibold text-slate-800">
              {mode === 'edit' ? 'Edit Stock Details' : 'Create New Stock'}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-slate-500">
              {mode === 'edit'
                ? 'Update the editable stock details below. Stock name and CIN cannot be changed.'
                : 'Fill in the details to create a new stock. CIN is required and becomes immutable.'}
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
                        <FormItem className="col-span-1 md:col-span-1">
                          <FormLabel className="text-slate-700 font-medium">Stock Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input 
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500" 
                              placeholder="e.g., Acme Corporation" 
                              disabled={mode === 'edit'} 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                if (mode === 'create' && !form.formState.dirtyFields.slug) {
                                  const generatedSlug = e.target.value
                                    .toLowerCase()
                                    .replace(/[^\w\s-]/g, '')
                                    .replace(/[\s_-]+/g, '-')
                                    .replace(/^-+|-+$/g, '');
                                  form.setValue('slug', generatedSlug, { shouldValidate: true });
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* URL Slug */}
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-1">
                          <FormLabel className="text-slate-700 font-medium">URL Slug <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input 
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500" 
                              placeholder="e.g., acme-corporation" 
                              {...field} 
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-slate-500 mt-1">Used in URL: /stocks/your-slug</FormDescription>
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



                    {/* Category */}
                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Category</FormLabel>
                          <Select
                            disabled={isCategoriesLoading}
                            onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                            value={field.value || 'none'}
                            defaultValue={field.value || 'none'}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 shadow-sm border-slate-200">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Category</SelectItem>
                              {categories?.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Minimum Purchase Quantity */}
                    <FormField
                      control={form.control}
                      name="minimumPurchaseQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Minimum Purchase Quantity</FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              type="number"
                              placeholder="e.g., 4"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === '' ? null : parseInt(value, 10));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Maximum Purchase Quantity */}
                    <FormField
                      control={form.control}
                      name="maximumPurchaseQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-slate-700 font-medium">Maximum Purchase Quantity</FormLabel>
                            {field.value != null && (
                              <button
                                type="button"
                                onClick={() => field.onChange(null)}
                                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                              >
                                Clear limit (No limit)
                              </button>
                            )}
                          </div>
                          <FormControl>
                            <Input
                              className="h-11 shadow-sm border-slate-200 focus-visible:ring-emerald-500"
                              type="number"
                              placeholder="e.g., 1000 (Leave empty for no limit)"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === '' ? null : parseInt(value, 10));
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px] text-slate-500 mt-1">Leave empty or clear to allow unlimited purchases</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Logo URL */}
                    <FormField
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
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
                  
                  {/* Company Overview */}
                  <FormField
                    control={form.control}
                    name="companyOverview"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-1">
                          <FormLabel className="text-slate-700 font-medium">Company Overview</FormLabel>
                          {companyDetails?.description && !field.value && (
                            <button
                              type="button"
                              onClick={() => {
                                // Wrap probe text in a paragraph tag for HTML compatibility
                                const htmlText = `<p>${companyDetails.description ?? ''}</p>`;
                                form.setValue('companyOverview', htmlText, { shouldDirty: true });
                              }}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                            >
                              Pre-fill from probe
                            </button>
                          )}
                        </div>
                        <FormControl>
                          <RichTextEditor
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder="Enter detailed company overview... Supports tables and rich text formatting."
                          />
                        </FormControl>
                        <FormDescription className="text-[10px] text-slate-500 mt-1">
                          Shown in the &quot;About Company&quot; section on the stock detail page. Overrides the probe description.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                {/* Identifiers Section */}
                <div className="space-y-4">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                    Business Identifiers
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 bg-slate-50/80 rounded-xl border border-slate-200/60 shadow-sm">
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
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
                          <FormLabel className="text-slate-700 font-medium">ISIN <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 font-mono text-sm uppercase shadow-sm border-slate-200 focus-visible:ring-blue-500"
                              placeholder="INE002A01018"
                              maxLength={12}
                              disabled={mode === 'edit' && !!stock?.isin}
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-slate-500">12-character International ID</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* PAN */}
                    <FormField
                      control={form.control}
                      name="pan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Company PAN <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 font-mono text-sm uppercase shadow-sm border-slate-200 focus-visible:ring-blue-500"
                              placeholder="ABCDE1234F"
                              maxLength={10}
                              disabled={mode === 'edit' && !!stock?.pan}
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-slate-500">10-character Company PAN</FormDescription>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Active Status */}
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start justify-between space-y-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer group">
                          <div className="space-y-1">
                            <FormLabel className="font-semibold text-sm text-slate-800 cursor-pointer">Active</FormLabel>
                            <p className="text-[11px] text-slate-500 leading-tight">Visible to all users on the trading platform.</p>
                          </div>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 scale-110" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Popular Status */}
                    <FormField
                      control={form.control}
                      name="isPopular"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start justify-between space-y-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-amber-300 hover:shadow-md cursor-pointer group">
                          <div className="space-y-1">
                            <FormLabel className="font-semibold text-sm text-slate-800 cursor-pointer">Popular</FormLabel>
                            <p className="text-[11px] text-slate-500 leading-tight">Feature this stock in the Popular tab section.</p>
                          </div>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 scale-110" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Market Movers Status */}
                    <FormField
                      control={form.control}
                      name="isMarketMover"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start justify-between space-y-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md cursor-pointer group">
                          <div className="space-y-1">
                            <FormLabel className="font-semibold text-sm text-slate-800 cursor-pointer">Market Mover</FormLabel>
                            <p className="text-[11px] text-slate-500 leading-tight">Group stock with other key market movers.</p>
                          </div>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 scale-110" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>



              </div>

              <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                <div className="flex w-full justify-between items-center">
                  <div>
                    {mode === 'edit' && stock?.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium"
                        onClick={() => setShowVersionHistory(true)}
                      >
                        View History
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={onCloseAction} disabled={isLoading} className="h-10 px-6 font-medium border-slate-300 text-slate-700 hover:bg-slate-100">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading} className="h-10 px-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shadow-sm hover:shadow-md">
                      {isLoading ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Stock'}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      {mode === 'edit' && stock?.id && (
        <>
          <VersionHistoryDialog
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            entityType="STOCK"
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
                entityType: 'STOCK',
                entityId: stock.id,
                versionNumber: rollbackVersion!
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
