import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyTickets,
  getUserTickets,
  getTicketById,
  createTicket,
  createComment,
  getAllLabels,
  CreateTicketDto,
  CreateCommentDto,
} from '@/lib/ticketing-api';

export const useMyTickets = (userId: string) => {
  return useQuery({
    queryKey: ['tickets', 'my', userId],
    queryFn: () => getMyTickets(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!userId,
  });
};

export const useUserTickets = (
  userId: string,
  options?: { status?: string; skip?: number; take?: number },
) => {
  const { status, skip, take } = options ?? {};
  return useQuery({
    queryKey: ['tickets', 'user', userId, status ?? 'all', skip ?? 0, take ?? 20],
    queryFn: () => getUserTickets(userId, { status, skip, take: take ?? 20 }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!userId,
  });
};

export const useTicketById = (id: string) => {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => getTicketById(id),
    enabled: !!id,
  });
};

export const useLabels = () => {
  return useQuery({
    queryKey: ['labels'],
    queryFn: getAllLabels,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      payload: CreateTicketDto | FormData;
      onUploadProgress?: (progressEvent: any) => void;
      signal?: AbortSignal;
    }) => createTicket(data.payload, data.onUploadProgress, data.signal),
    onSuccess: (_, variables) => {
      const payload = variables.payload;
      const createdBy =
        payload instanceof FormData
          ? (payload.get('createdBy') as string)
          : payload.createdBy;
      queryClient.invalidateQueries({ queryKey: ['tickets', 'my', createdBy] });
    },
  });
};

export const useCreateComment = (ticketId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentDto) => createComment(ticketId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] });
    },
  });
};