'use client';

/**
 * Support Ticket Details Dialog Component
 *
 * Modern Linear/Intercom-grade dual-pane ticket inspector:
 * - Left Pane (68%): Inquiry timeline, attachment files, internal notes, and dual-mode composer.
 * - Right Pane (32%): Ticket Inspector metadata, customer card, assignee card, and quick properties.
 */

import { useState, memo, Suspense, useMemo } from 'react';
import { useSupportAuth } from '@/hooks/use-support-auth';
import { useQueries } from '@tanstack/react-query';
import {
  useSupportTicketById,
  useUpdateTicketStatus,
  useUpdateTicketPriority,
  useAssignTicket,
  useResolveTicket,
  useEscalateTicket,
  useAddSupportComment,
} from '@/hooks/use-support-tickets';
import { useUserById } from '@/hooks/use-user-by-id';
import { useAdminById } from '@/hooks/use-admin-by-id';
import { getAdminById, AdminBasicInfo } from '@/lib/admin-api';
import { getUserById, UserBasicInfo } from '@/lib/support-users-api';
import { formatDateTime } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusUpdater } from '@/components/admin/status-updater';
import {
  FileText,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Send,
  Lock,
  MessageSquare,
  Shield,
  Download,
  Mail,
  Phone,
  Calendar,
  Layers,
  Sparkles,
  Inbox,
  User as UserIcon,
} from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import { cn } from '@/lib/utils';

interface SupportTicketDetailsDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommentItemProps {
  comment: { id: string; userId: string; content: string; createdAt: string; isInternal: boolean };
  currentUserId: string | undefined;
  canSeeInternal: boolean;
  authorsMap: Record<string, { admin: AdminBasicInfo | null; user: UserBasicInfo | null } | undefined>;
}

const CommentItem = memo(function CommentItem({
  comment,
  currentUserId,
  canSeeInternal,
  authorsMap,
}: CommentItemProps) {
  if (!comment.userId) {
    return null;
  }

  const isCurrentUser = comment.userId === currentUserId;
  const authorData = authorsMap[comment.userId];

  let displayName = 'Loading...';
  let isAgent = false;

  if (isCurrentUser) {
    displayName = 'You';
    isAgent = true;
  } else if (!authorData) {
    displayName = 'Loading...';
  } else if (authorData.admin?.role === 'SUPPORT_AGENT' || authorData.admin?.role === 'SUPER_ADMIN') {
    displayName = authorData.admin.fullName || authorData.admin.email || 'Agent';
    isAgent = true;
  } else if (authorData.user) {
    displayName = authorData.user.fullName || authorData.user.email || 'Customer';
    isAgent = false;
  } else {
    displayName = comment.userId.slice(0, 8);
  }

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'p-4 rounded-2xl border transition-all text-xs space-y-2',
        comment.isInternal
          ? 'bg-gradient-to-br from-amber-50/80 to-amber-100/40 border-amber-200/80 shadow-2xs'
          : isAgent
          ? 'bg-emerald-50/50 border-emerald-200/60'
          : 'bg-white border-slate-200/70 shadow-2xs'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
              comment.isInternal
                ? 'bg-amber-200/80 text-amber-900 border-amber-300'
                : isAgent
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-slate-200 text-slate-800 border-slate-300'
            )}
          >
            {initial}
          </div>
          <span className="font-bold text-slate-900">{displayName}</span>
          {comment.isInternal && canSeeInternal ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-amber-200/70 text-amber-900 border border-amber-300">
              <Lock className="w-2.5 h-2.5" />
              Internal Note
            </span>
          ) : isAgent ? (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300/60">
              Support Staff
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-100 text-slate-600">
              Customer
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium text-slate-400">
          {formatDateTime(comment.createdAt)}
        </span>
      </div>

      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap pl-8">
        {comment.content}
      </p>
    </div>
  );
});

export function SupportTicketDetailsDialog({
  ticketId,
  open,
  onOpenChange,
}: SupportTicketDetailsDialogProps) {
  const { supportAdmin } = useSupportAuth();
  const { data: ticket, isLoading, error } = useSupportTicketById(ticketId || '');

  // Mutations
  const updateStatusMutation = useUpdateTicketStatus();
  const updatePriorityMutation = useUpdateTicketPriority();
  const assignMutation = useAssignTicket();
  const resolveMutation = useResolveTicket();
  const escalateMutation = useEscalateTicket();
  const addCommentMutation = useAddSupportComment();

  // Permission checks
  const isSuperAdmin = supportAdmin?.role === 'SUPER_ADMIN';
  const canUpdateTickets = supportAdmin?.permissions?.includes('update_ticket_status') || isSuperAdmin;
  const canUpdatePriority = supportAdmin?.permissions?.includes('update_ticket_priority') || isSuperAdmin;
  const canAssignTickets = supportAdmin?.permissions?.includes('assign_tickets') || isSuperAdmin;
  const canResolveTickets = supportAdmin?.permissions?.includes('update_ticket_status') || isSuperAdmin;
  const canEscalateTickets = supportAdmin?.permissions?.includes('escalate_tickets') || isSuperAdmin;
  const canAddInternalNotes = supportAdmin?.permissions?.includes('add_internal_notes') || isSuperAdmin;

  // Composer State
  const [commentContent, setCommentContent] = useState('');
  const [composerMode, setComposerMode] = useState<'public' | 'internal'>('public');

  const createdById = ticket?.createdBy;
  const assignedToId = ticket?.assignedTo;

  const { data: createdByUser, isLoading: isLoadingCreatedBy } = useUserById(createdById);
  const { data: createdByAdmin } = useAdminById(createdById);
  const { data: assignedToAdmin } = useAdminById(assignedToId);

  const uniqueAuthorIds = ticket?.comments
    ? [...new Set(ticket.comments.map((c) => c.userId).filter(Boolean))]
    : [];

  const authorQueries = useMemo(
    () =>
      uniqueAuthorIds.map((userId) => ({
        queryKey: ['author', userId],
        queryFn: () =>
          Promise.allSettled([getAdminById(userId), getUserById(userId)]).then((results) => ({
            admin: results[0].status === 'fulfilled' ? results[0].value : null,
            user: results[1].status === 'fulfilled' ? results[1].value : null,
          })),
        staleTime: 5 * 60 * 1000,
        suspense: false,
      })),
    [uniqueAuthorIds.join(',')]
  );

  const authorsData = useQueries({ queries: authorQueries });

  const authorsMap = useMemo(
    () =>
      Object.fromEntries(
        authorsData.map((query, index) => [uniqueAuthorIds[index], query.data])
      ),
    [authorsData, uniqueAuthorIds]
  );

  const getStatusOptions = (currentStatus: string) => {
    const allOptions = [
      { value: 'open', label: 'Open', variant: 'outline' as const },
      { value: 'in-progress', label: 'In Progress', variant: 'default' as const },
      { value: 'resolved', label: 'Resolved', variant: 'default' as const },
      { value: 'closed', label: 'Closed', variant: 'secondary' as const },
      { value: 'blocked', label: 'Blocked', variant: 'destructive' as const },
    ];

    switch (currentStatus) {
      case 'open':
        return allOptions.filter((opt) => ['in-progress', 'blocked'].includes(opt.value));
      case 'in-progress':
        return allOptions.filter((opt) => ['resolved', 'blocked'].includes(opt.value));
      case 'resolved':
        return allOptions.filter((opt) => ['closed'].includes(opt.value));
      case 'blocked':
        return allOptions.filter((opt) => ['open', 'in-progress'].includes(opt.value));
      case 'closed':
        return [];
      default:
        return allOptions;
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!ticketId) return;
    try {
      await updateStatusMutation.mutateAsync({ ticketId, status: newStatus });
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const handlePriorityUpdate = async (newPriority: string | null) => {
    if (!ticketId) return;
    if (!newPriority && !isSuperAdmin) {
      notify.error('Only Super Admin can unset ticket priority');
      return;
    }
    try {
      await updatePriorityMutation.mutateAsync({ ticketId, priority: !newPriority ? null : newPriority });
    } catch (err) {
      console.error('Failed to update ticket priority:', err);
    }
  };

  const handleAssignTicket = async () => {
    if (!supportAdmin?.id || !ticket) return;
    try {
      await assignMutation.mutateAsync({
        ticketId: ticket.id,
        agentId: supportAdmin.id,
        assignedBy: supportAdmin.id,
      });
    } catch (err) {
      console.error('Failed to assign ticket:', err);
    }
  };

  const handleResolveTicket = async () => {
    if (!supportAdmin?.id || !ticket) return;
    try {
      await resolveMutation.mutateAsync({ ticketId: ticket.id, resolvedBy: supportAdmin.id });
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
    }
  };

  const handleEscalateTicket = async () => {
    if (!ticket) return;
    try {
      await escalateMutation.mutateAsync({ ticketId: ticket.id });
    } catch (err) {
      console.error('Failed to escalate ticket:', err);
    }
  };

  const handleAddComment = async () => {
    if (!commentContent.trim() || !supportAdmin?.id || !ticketId) return;

    try {
      await addCommentMutation.mutateAsync({
        ticketId,
        content: commentContent.trim(),
        userId: supportAdmin.id,
        isInternal: composerMode === 'internal',
      });
      setCommentContent('');
    } catch (err: any) {
      notify.error(err.message || 'Failed to submit comment');
    }
  };

  if (!ticketId) return null;

  const isClosedOrResolved = ticket?.status === 'resolved' || ticket?.status === 'closed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden bg-slate-50 p-0 border border-slate-200/80 rounded-3xl shadow-2xl flex flex-col">
        {/* Top Header Bar */}
        <div className="bg-white px-6 py-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {ticket?.ticketNumber || `#${ticketId.slice(0, 8)}`}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">
                {isLoading ? <Skeleton className="h-5 w-48" /> : ticket?.title || 'Ticket Details'}
              </h2>
              {ticket && (
                <p className="text-[11px] text-slate-400 font-medium">
                  Opened {formatDateTime(ticket.createdAt)}
                </p>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          {ticket && (
            <div className="flex items-center gap-2 shrink-0">
              {canAssignTickets && !ticket.assignedTo && (
                <Button
                  size="sm"
                  onClick={handleAssignTicket}
                  disabled={assignMutation.isPending}
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Assign to Me
                </Button>
              )}

              {canResolveTickets && ticket.status === 'in-progress' && (
                <Button
                  size="sm"
                  onClick={handleResolveTicket}
                  disabled={resolveMutation.isPending}
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Resolve
                </Button>
              )}

              {canEscalateTickets &&
                ticket.status !== 'resolved' &&
                ticket.status !== 'closed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEscalateTicket}
                    disabled={escalateMutation.isPending}
                    className="h-8 px-3 border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 font-bold text-xs rounded-xl"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Escalate
                  </Button>
                )}
            </div>
          )}
        </div>

        {/* Dual-Pane Body */}
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">Failed to load ticket details</p>
          </div>
        ) : ticket ? (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Left Pane: Conversation & Timeline (68%) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 border-r border-slate-200/70">
              {/* Original Customer Inquiry Box */}
              <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    Original Customer Inquiry
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formatDateTime(ticket.createdAt)}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
                  {ticket.description || 'No description provided.'}
                </p>

                {/* Attachments Section */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Attached Files ({ticket.attachments.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ticket.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate" title={att.filename}>
                                {att.filename}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {(att.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/api/tickets/${ticket.id}/attachments/${att.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Activity / Comments Stream */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                    Activity & Replies
                  </h4>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {ticket.comments?.length || 0} messages
                  </span>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const visibleComments =
                      ticket.comments?.filter((c) => !c.isInternal || canAddInternalNotes) || [];

                    if (visibleComments.length === 0) {
                      return (
                        <div className="py-8 text-center bg-white/70 border border-slate-200/60 rounded-2xl">
                          <MessageSquare className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                          <p className="text-xs text-slate-400">No replies yet. Be the first to respond.</p>
                        </div>
                      );
                    }

                    return visibleComments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        currentUserId={supportAdmin?.id}
                        canSeeInternal={canAddInternalNotes}
                        authorsMap={authorsMap}
                      />
                    ));
                  })()}
                </div>
              </div>

              {/* Message Composer */}
              {isClosedOrResolved ? (
                <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                  This ticket is {ticket.status}. Reopen or update status to submit additional replies.
                </div>
              ) : (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                  {/* Mode Selector */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setComposerMode('public')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all',
                          composerMode === 'public'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Public Reply</span>
                      </button>

                      {canAddInternalNotes && (
                        <button
                          type="button"
                          onClick={() => setComposerMode('internal')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all',
                            composerMode === 'internal'
                              ? 'bg-amber-500 text-slate-950 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          )}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Internal Note</span>
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] font-semibold text-slate-400">
                      {composerMode === 'internal'
                        ? '🔒 Only visible to staff'
                        : '💬 Customer will be notified'}
                    </span>
                  </div>

                  <Textarea
                    placeholder={
                      composerMode === 'internal'
                        ? 'Add internal coordination notes for the support team...'
                        : 'Type your message to the customer...'
                    }
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className={cn(
                      'min-h-[90px] text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all resize-none placeholder:text-slate-400',
                      composerMode === 'internal' && 'focus:border-amber-500 focus:ring-amber-500/10'
                    )}
                  />

                  <div className="flex items-center justify-end">
                    <Button
                      onClick={handleAddComment}
                      disabled={!commentContent.trim() || addCommentMutation.isPending}
                      className={cn(
                        'h-8 px-4 font-bold text-xs rounded-xl shadow-xs transition-all',
                        composerMode === 'internal'
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      )}
                    >
                      {addCommentMutation.isPending ? (
                        'Sending...'
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {composerMode === 'internal' ? 'Post Internal Note' : 'Send Public Reply'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Pane: Ticket Inspector (32%) */}
            <div className="w-full md:w-80 lg:w-88 bg-white p-6 space-y-6 overflow-y-auto shrink-0 border-t md:border-t-0 border-slate-200/70">
              {/* Properties Section */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                  Ticket Properties
                </h3>

                {/* Status Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Status</label>
                  {canUpdateTickets ? (
                    <StatusUpdater
                      currentStatus={ticket.status}
                      statusOptions={getStatusOptions(ticket.status)}
                      onUpdate={handleStatusUpdate}
                      disabled={!canUpdateTickets}
                      entityType="order"
                      entityId={ticket.id}
                    />
                  ) : (
                    <p className="text-xs font-bold text-slate-800 uppercase">{ticket.status}</p>
                  )}
                </div>

                {/* Priority Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Priority Level</label>
                  {canUpdatePriority ? (
                    <select
                      value={ticket.priority || ''}
                      onChange={(e) => handlePriorityUpdate(e.target.value || null)}
                      disabled={updatePriorityMutation.isPending}
                      className="w-full h-8 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 bg-white px-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {isSuperAdmin ? (
                        <option value="">— (Not Set)</option>
                      ) : !ticket.priority ? (
                        <option value="" disabled>— (Not Set)</option>
                      ) : null}
                      <option value="urgent">🔴 Urgent</option>
                      <option value="high">🟠 High</option>
                      <option value="medium">🔵 Medium</option>
                      <option value="low">⚪ Low</option>
                    </select>
                  ) : (
                    <p className="text-xs font-bold text-slate-800 uppercase">
                      {ticket.priority || '—'}
                    </p>
                  )}
                </div>

                {/* Category & Channel */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Category</span>
                    <p className="text-xs font-bold text-slate-700 capitalize">
                      {ticket.category || 'General'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Channel</span>
                    <p className="text-xs font-bold text-slate-700 uppercase">
                      {ticket.source || 'Web'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2.5">
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Customer Profile
                </h4>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                    {(createdByUser?.fullName || ticket.createdBy || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {createdByUser?.fullName || 'User'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {createdByUser?.email || ticket.createdBy}
                    </p>
                  </div>
                </div>

                {createdByUser?.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{createdByUser.phone}</span>
                  </div>
                )}
              </div>

              {/* Assigned Agent Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2.5">
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Assigned Staff
                </h4>
                {ticket.assignedTo ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold border border-emerald-300">
                      {(assignedToAdmin?.fullName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {assignedToAdmin?.fullName || assignedToAdmin?.email || ticket.assignedTo}
                      </p>
                      <span className="text-[9px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                        Assigned Agent
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No agent assigned</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}