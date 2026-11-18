import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import {
  getStockDetailsAdmin,
  getStockDocumentsAdmin,
  createDocumentAdmin,
  updateDocumentAdmin,
  deleteDocumentAdmin,
  getStockPriceHistoryAdmin,
  addStockPriceAdmin,
  deleteStockPriceAdmin,
} from '@/lib/admin-api';
import { updateStock } from '@/lib/stocks-api';
import type {
  Stock,
  StockDocument,
  StockPrice,
  CreateStockPriceDto,
  CreateDocumentDto,
  UpdateDocumentDto,
  UpdateStockDto,
} from '@/types/stock';

// ============================================
// ADMIN STOCK DETAILS HOOKS
// ============================================

/**
 * Query hook for fetching stock details (Admin)
 */
export function useAdminStockDetails(stockId: string) {
  return useQuery({
    queryKey: ['admin', 'stock', stockId],
    queryFn: () => getStockDetailsAdmin(stockId),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    enabled: !!stockId,
  });
}

// ============================================
// ADMIN DOCUMENTS HOOKS
// ============================================

/**
 * Query hook for fetching documents for a stock (Admin)
 */
export function useAdminDocuments(stockId: string) {
  return useQuery({
    queryKey: ['admin', 'stock', stockId, 'documents'],
    queryFn: () => getStockDocumentsAdmin(stockId),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    enabled: !!stockId,
  });
}

/**
 * Mutation hook for creating a document (Admin)
 */
export function useCreateAdminDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, dto }: { stockId: string; dto: CreateDocumentDto }) =>
      createDocumentAdmin(stockId, dto),
    onSuccess: (data, { stockId }) => {
      // Invalidate documents query
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId, 'documents'] });
      // Invalidate main stocks list
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });
      notify.success('Document created successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

/**
 * Mutation hook for updating a document (Admin)
 */
export function useUpdateAdminDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stockId,
      documentId,
      dto,
    }: {
      stockId: string;
      documentId: string;
      dto: UpdateDocumentDto;
    }) => updateDocumentAdmin(stockId, documentId, dto),
    onSuccess: (data, { stockId }) => {
      // Invalidate documents query
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId, 'documents'] });
      // Invalidate main stocks list
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });
      notify.success('Document updated successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

/**
 * Mutation hook for deleting a document (Admin)
 */
export function useDeleteAdminDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, documentId }: { stockId: string; documentId: string }) =>
      deleteDocumentAdmin(stockId, documentId),
    onSuccess: (data, { stockId }) => {
      // Invalidate documents query
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId, 'documents'] });
      // Invalidate main stocks list
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });
      notify.success('Document deleted successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

// ============================================
// ADMIN BASIC INFO HOOK
// ============================================

/**
 * Mutation hook for updating stock basic info (Admin)
 */
export function useUpdateAdminStockBasicInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, dto }: { stockId: string; dto: UpdateStockDto }) =>
      updateStock(stockId, dto),
    onSuccess: (data, { stockId }) => {
      // Invalidate main stocks list
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });
      // Invalidate admin stock details cache
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId] });
      notify.success('Stock basic info updated successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}
/**
 * Query hook for fetching price history (Admin)
 */
export function useAdminPriceHistory(stockId: string) {
  return useQuery({
    queryKey: ['admin', 'stock', stockId, 'prices'],
    queryFn: () => getStockPriceHistoryAdmin(stockId),
    enabled: !!stockId,
  });
}

/**
 * Mutation hook for adding a price point (Admin)
 */
export function useAddAdminPricePoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, dto }: { stockId: string; dto: CreateStockPriceDto }) =>
      addStockPriceAdmin(stockId, dto),
    onSuccess: (_, { stockId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId, 'prices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId] });
      notify.success('Price point added successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

/**
 * Mutation hook for deleting a price point (Admin)
 */
export function useDeleteAdminPricePoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, priceId }: { stockId: string; priceId: string }) => deleteStockPriceAdmin(priceId),
    onSuccess: (_, { stockId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId, 'prices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stock', stockId] });
      notify.success('Price point deleted successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}
