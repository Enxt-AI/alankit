import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyTickets,
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
    mutationFn: (data: CreateTicketDto | FormData) => createTicket(data),
    onSuccess: (_, variables) => {
      // Extract createdBy from variables
      const createdBy = variables instanceof FormData ? variables.get('createdBy') as string : variables.createdBy;
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