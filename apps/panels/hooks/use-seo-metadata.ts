import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllSeoMetadata,
  getSeoMetadataByPath,
  upsertSeoMetadata,
  deleteSeoMetadata,
  UpsertSeoMetadataDto,
} from '@/lib/seo-metadata-api';

export function useAllSeoMetadata() {
  return useQuery({
    queryKey: ['cms', 'seo-metadata'],
    queryFn: getAllSeoMetadata,
  });
}

export function useSeoMetadataByPath(path: string) {
  return useQuery({
    queryKey: ['cms', 'seo-metadata', path],
    queryFn: () => getSeoMetadataByPath(path),
    enabled: !!path,
    retry: false,
  });
}

export function useUpsertSeoMetadata() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (dto: UpsertSeoMetadataDto) => upsertSeoMetadata(dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'seo-metadata'] });
      queryClient.invalidateQueries({ queryKey: ['cms', 'seo-metadata', data.path] });
    },
  });
}

export function useDeleteSeoMetadata() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteSeoMetadata(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'seo-metadata'] });
    },
  });
}
