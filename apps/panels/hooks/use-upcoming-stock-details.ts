/**
 * TanStack Query hooks for upcoming stock details (documents and extended data)
 * Mirrors the patterns used by use-stock-details.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUpcomingStockById,
  getUpcomingStockDocumentsCms,
  createUpcomingDocumentCms,
  updateUpcomingDocumentCms,
  deleteUpcomingDocumentCms,
} from '@/lib/stocks-api';
import type {
  UpcomingStock,
  UpcomingStockDocument,
  CreateUpcomingDocumentDto,
  UpdateUpcomingDocumentDto,
} from '@/types/stock';

export function useUpcomingStockDetails(id: string) {
  return useQuery<UpcomingStock, Error>({
    queryKey: ['upcoming-stock', id],
    queryFn: () => getUpcomingStockById(id),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!id,
  });
}

// ============================================
// DOCUMENTS HOOKS
// ============================================

export function useUpcomingDocuments(stockId: string) {
  return useQuery<UpcomingStockDocument[], Error>({
    queryKey: ['upcoming-stock', stockId, 'documents'],
    queryFn: () => getUpcomingStockDocumentsCms(stockId),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!stockId,
  });
}

export function useCreateUpcomingDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, dto }: { stockId: string; dto: CreateUpcomingDocumentDto }) =>
      createUpcomingDocumentCms(stockId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-stock', variables.stockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-stock', variables.stockId] });
    },
  });
}

export function useUpdateUpcomingDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stockId,
      documentId,
      dto,
    }: {
      stockId: string;
      documentId: string;
      dto: UpdateUpcomingDocumentDto;
    }) => updateUpcomingDocumentCms(stockId, documentId, dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-stock', variables.stockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-stock', variables.stockId] });
    },
  });
}

export function useDeleteUpcomingDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stockId, documentId }: { stockId: string; documentId: string }) =>
      deleteUpcomingDocumentCms(stockId, documentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-stock', variables.stockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-stock', variables.stockId] });
    },
  });
}
