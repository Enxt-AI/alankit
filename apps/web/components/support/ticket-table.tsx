'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useMyTickets } from '@/hooks/use-tickets';
import { Ticket } from '@/types/ticket';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface TicketTableProps {
  onTicketClick: (ticketId: string) => void;
}

const statusColors = {
  open: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  'in-progress': 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  resolved: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  closed: 'bg-gray-100 text-gray-700 hover:bg-red-100',
  blocked: 'bg-red-100 text-red-700 hover:bg-gray-100',
  escalated: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  medium: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  high: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  urgent: 'bg-red-100 text-red-700 hover:bg-red-100',
};

export function TicketTable({ onTicketClick }: TicketTableProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, isLoading, error } = useMyTickets(user?.id || '');
  const tickets = data as Ticket[] | undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-3/4 mb-1" />
            <Skeleton className="h-4 w-full mb-3" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertDescription>
          Failed to load tickets. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Card className="border-0 sm:border border-gray-200 shadow-xl shadow-gray-200/40 sm:shadow-sm rounded-3xl sm:rounded-xl">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-base font-bold text-gray-900">No tickets yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first support ticket above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Card className="border border-slate-200/80 shadow-2xs rounded-2xl bg-white">
        <CardHeader className="flex flex-row items-center justify-between p-3.5 sm:p-5 pb-2 sm:pb-3 border-b border-slate-100">
          <CardTitle className="text-sm sm:text-base font-bold text-[#1A2530]">Your Tickets</CardTitle>
          {/* <Button variant="link" className="text-xs font-bold text-green-600 h-auto p-0 hover:no-underline">View All</Button> */}
        </CardHeader>
        <CardContent className="p-3.5 sm:p-5 grid gap-2.5 sm:gap-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={(e) => {
                e.stopPropagation();
                onTicketClick(ticket.ticketNumber || ticket.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTicketClick(ticket.ticketNumber || ticket.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View details for ticket: ${ticket.title}`}
              className="p-2.5 sm:p-3 rounded-xl border border-slate-100 bg-white hover:border-green-200 transition-all cursor-pointer">
              <div className="flex justify-between items-center mb-1.5 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {ticket.ticketNumber || `#${ticket.id.slice(0, 8)}`}
                  </span>
                  <Badge variant="secondary" className={`${statusColors[ticket.status]} border-0 text-[10px] px-2 py-0.5 font-bold uppercase`}>
                    {ticket.status}
                  </Badge>
                  <Badge className={`${priorityColors[ticket.priority]} border-0 text-[10px] px-2 py-0.5 font-bold uppercase`}>
                    {ticket.priority}
                  </Badge>
                </div>

                <span className="text-[10px] sm:text-xs text-slate-400 font-medium shrink-0">{formatDate(ticket.createdAt)}</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-[#1A2530] mb-0.5 leading-snug line-clamp-1">{ticket.title}</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 mb-2">
                {ticket.description}
              </p>

            </div>
          ))}
        </CardContent>
        <div className="border-t border-slate-100 p-2.5 sm:p-3 bg-slate-50/60 rounded-b-2xl flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/tickets')}
            className="text-xs font-bold flex items-center gap-1 text-slate-600 hover:text-slate-900"
          >
            View All Tickets <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </Card>
    </div>
  );
}