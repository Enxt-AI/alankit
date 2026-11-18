import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stocksApi } from '@/lib/api-client';
import { StockCategory } from '@/types/stock';
import { toast } from 'sonner';

export const useAdminStockCategories = () => {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'stock-categories'],
    queryFn: async () => {
      const { data } = await stocksApi.get<StockCategory[]>('/cms/stocks/categories');
      return data;
    },
  });

  // NOTE: CMS category writes are maker-checker — they create a PENDING
  // ChangeRequest and go live only after admin approval in /admin/approvals.
  const createCategory = useMutation({
    mutationFn: async (payload: { name: string; description?: string; isActive?: boolean }) => {
      const { data } = await stocksApi.post('/cms/stocks/categories', payload);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock-categories'] });
      toast.success(data?.message || 'Category creation submitted for admin approval');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create category');
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; description?: string; isActive?: boolean }) => {
      const { data } = await stocksApi.put(`/cms/stocks/categories/${id}`, payload);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock-categories'] });
      toast.success(data?.message || 'Category update submitted for admin approval');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update category');
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await stocksApi.delete(`/cms/stocks/categories/${id}`);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock-categories'] });
      toast.success(data?.message || 'Category deletion submitted for admin approval');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete category');
    },
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: categoriesQuery.isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};
