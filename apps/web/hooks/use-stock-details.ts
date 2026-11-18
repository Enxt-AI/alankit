/**
 * TanStack Query hooks for stock details (directors, documents, extended data)
 * Provides hooks for fetching and managing stock details with automatic caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStockById,
  updateStockCms,
  getStockDirectorsCms,
  createDirectorCms,
  updateDirectorCms,
  deleteDirectorCms,
  getStockDocumentsCms,
  createDocumentCms,
  updateDocumentCms,
  deleteDocumentCms
} from '@/lib/stocks-api';
import type {
  Stock,
  StockDirector,
  StockDocument,
  CreateDirectorDto,
  UpdateDirectorDto,
  CreateDocumentDto,
  UpdateDocumentDto
} from '@/types/stock';

/**
 * Hook to fetch stock with extended details (directors, documents, marketCap)
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
    mutationFn: ({ stockId, data }: { stockId: string; data: Record<string, never> }) =>
      updateStockCms(stockId, data),
    onSuccess: (updatedStock) => {
      queryClient.setQueryData(['stock', updatedStock.id], updatedStock);
      console.log('Stock basic info updated successfully');
    },
    onError: (error: Error) => {
      console.error(`Failed to update stock: ${error.message}`);
    },
  });
}

// ============================================
// DIRECTORS HOOKS
// ============================================

/**
 * Fetch all directors for a stock (CMS)
 * @param stockId - Stock ID
 */
export function useDirectors(stockId: string) {
  return useQuery<StockDirector[], Error>({
    queryKey: ['stock', stockId, 'directors'],
    queryFn: () => getStockDirectorsCms(stockId),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!stockId,
  });
}

/**
 * Create a new director for a stock (CMS)
 * Invalidates: ['stock', stockId, 'directors'] and ['stock', stockId, 'details']
 */
export function useCreateDirector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, dto }: { stockId: string; dto: CreateDirectorDto }) =>
      createDirectorCms(stockId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'directors'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId] });
    },
  });
}

/**
 * Update a director (CMS)
 * Invalidates: ['stock', stockId, 'directors'] and ['stock', stockId, 'details']
 */
export function useUpdateDirector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, directorId, dto }: { stockId: string; directorId: string; dto: UpdateDirectorDto }) =>
      updateDirectorCms(stockId, directorId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'directors'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId] });
    },
  });
}

/**
 * Delete a director (CMS)
 * Invalidates: ['stock', stockId, 'directors'] and ['stock', stockId, 'details']
 */
export function useDeleteDirector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, directorId }: { stockId: string; directorId: string }) =>
      deleteDirectorCms(stockId, directorId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'directors'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId, 'details'] });
      queryClient.invalidateQueries({ queryKey: ['stock', variables.stockId] });
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