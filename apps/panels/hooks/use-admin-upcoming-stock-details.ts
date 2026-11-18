import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import type {
  UpcomingStock,
  UpcomingStockDocument,
  CreateUpcomingDocumentDto,
  UpdateUpcomingDocumentDto,
} from '@/types/stock';
import {
  getUpcomingStockDetailsAdmin,
  getUpcomingStockDetailsCms,
  getUpcomingStockDocumentsAdmin,
  getUpcomingStockDocumentsCms,
  createUpcomingDocumentAdmin,
  createUpcomingDocumentCms,
  updateUpcomingDocumentAdmin,
  updateUpcomingDocumentCms,
  deleteUpcomingDocumentAdmin,
  deleteUpcomingDocumentCms,
} from '@/lib/upcoming-stocks-details-api';

// ============================================
// UPCOMING STOCK DETAILS HOOKS (ADMIN/CMS)
// ============================================

export function useUpcomingStockDetails(upcomingStockId: string, useCmsEndpoint?: boolean) {
  return useQuery<UpcomingStock, Error>({
    queryKey: ['admin', 'upcoming-stock', upcomingStockId],
    queryFn: () =>
      useCmsEndpoint ? getUpcomingStockDetailsCms(upcomingStockId) : getUpcomingStockDetailsAdmin(upcomingStockId),
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !!upcomingStockId,
  });
}

export function useUpcomingStockDocuments(upcomingStockId: string, useCmsEndpoint?: boolean) {
  return useQuery<UpcomingStockDocument[], Error>({
    queryKey: ['admin', 'upcoming-stock', upcomingStockId, 'documents'],
    queryFn: () =>
      useCmsEndpoint
        ? getUpcomingStockDocumentsCms(upcomingStockId)
        : getUpcomingStockDocumentsAdmin(upcomingStockId),
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!upcomingStockId,
  });
}

export function useCreateUpcomingStockDocument(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upcomingStockId,
      dto,
    }: {
      upcomingStockId: string;
      dto: CreateUpcomingDocumentDto;
    }) => (useCmsEndpoint ? createUpcomingDocumentCms(upcomingStockId, dto) : createUpcomingDocumentAdmin(upcomingStockId, dto)),
    onSuccess: (_data, { upcomingStockId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stock', upcomingStockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stocks'] });
      notify.success('Upcoming stock document created successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

export function useUpdateUpcomingStockDocument(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upcomingStockId,
      documentId,
      dto,
    }: {
      upcomingStockId: string;
      documentId: string;
      dto: UpdateUpcomingDocumentDto;
    }) =>
      useCmsEndpoint
        ? updateUpcomingDocumentCms(upcomingStockId, documentId, dto)
        : updateUpcomingDocumentAdmin(upcomingStockId, documentId, dto),
    onSuccess: (_data, { upcomingStockId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stock', upcomingStockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stocks'] });
      notify.success('Upcoming stock document updated successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

export function useDeleteUpcomingStockDocument(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      upcomingStockId,
      documentId,
    }: {
      upcomingStockId: string;
      documentId: string;
    }) =>
      useCmsEndpoint
        ? deleteUpcomingDocumentCms(upcomingStockId, documentId)
        : deleteUpcomingDocumentAdmin(upcomingStockId, documentId),
    onSuccess: (_data, { upcomingStockId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stock', upcomingStockId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stocks'] });
      notify.success('Upcoming stock document deleted successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}
