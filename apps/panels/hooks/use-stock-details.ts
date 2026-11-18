/**
 * TanStack Query hooks for stock details (documents and extended data)
 * Provides hooks for fetching and managing stock details with automatic caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import {
  getStockById,
  updateStockCms,
  getStockDocumentsCms,
  createDocumentCms,
  updateDocumentCms,
  deleteDocumentCms
} from '@/lib/stocks-api';
import type {
  Stock,
  StockDocument,
  CreateDocumentDto,
  UpdateDocumentDto
} from '@/types/stock';

/**
 * Hook to fetch stock with extended details (documents and marketCap)
 * This replaces useStock when you need full details
 * @param id - Stock ID
 * @returns Query result with extended stock data
 */
export function useStockDetails(id: string) {
  return useQuery<Stock, Error>({
    queryKey: ['stock', id], // Same key as useStock to share cache
    queryFn: () => getStockById(id), // Backend now returns extended data
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!id,
  });
}

// Basic Info Update Mutation
export function useUpdateStockBasicInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, data }: { stockId: string; data: { name?: string; slug?: string; minimumPurchaseQuantity?: number | null; maximumPurchaseQuantity?: number | null } }) =>
      updateStockCms(stockId, data),
    // NOTE: CMS stock edits are maker-checker — the response is an approval
    // envelope, so refresh from the server instead of writing it into cache.
    onSuccess: (result: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });
      notify.success(result?.message || 'Stock update submitted for admin approval. It will go live after approval.');
    },
    onError: (error: Error) => {
      notify.error(`Failed to update stock: ${error.message}`);
    },
  });
}

// ============================================
// DOCUMENTS HOOKS
// ============================================

/**
 * Fetch all documents for a stock (CMS)
 * @param stockId - Stock ID
 */
export function useDocuments(stockId: string) {
  return useQuery<StockDocument[], Error>({
    queryKey: ['stock', stockId, 'documents'],
    queryFn: () => getStockDocumentsCms(stockId),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!stockId,
  });
}

/**
 * Create a new document for a stock (CMS)
 * Invalidates: ['stock', stockId, 'documents'] and ['stock', stockId, 'details']
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, dto }: { stockId: string; dto: CreateDocumentDto }) =>
      createDocumentCms(stockId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId] });
    },
  });
}

/**
 * Update a document (CMS)
 * Invalidates: ['stock', stockId, 'documents'] and ['stock', stockId, 'details']
 */
export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, documentId, dto }: { stockId: string; documentId: string; dto: UpdateDocumentDto }) =>
      updateDocumentCms(stockId, documentId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId] });
    },
  });
}

/**
 * Delete a document (CMS)
 * Invalidates: ['stock', stockId, 'documents'] and ['stock', stockId, 'details']
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, documentId }: { stockId: string; documentId: string }) =>
      deleteDocumentCms(stockId, documentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId] });
    },
  });
}