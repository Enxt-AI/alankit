"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Download,
  AlertCircle,
  MessageSquare,
  Clock,
  CheckCircle2,
  ShieldCheck,
  User as UserIcon,
  Headphones,
  FileText,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useTicketById, useCreateComment } from "@/hooks/use-tickets";
import { Ticket } from "@/types/ticket";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

function renderStatusBadge(status: string) {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "in-progress":
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          In Progress
        </span>
      );
    case "open":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          Open
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Resolved
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70">
          Closed
        </span>
      );
    case "escalated":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/70">
          Escalated
        </span>
      );
    case "blocked":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
          Blocked
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          {status}
        </span>
      );
  }
}

function renderPriorityBadge(priority: string) {
  const p = (priority || "").toLowerCase().trim();
  if (p === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70">
        <span className="w-1 h-1 rounded-full bg-rose-500" />
        Urgent
      </span>
    );
  }
  if (p === "high") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200/70">
        High Priority
      </span>
    );
  }
  return null;
}

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { data: ticket, isLoading, error, refetch } = useTicketById(ticketId || "");
  const ticketData = ticket as Ticket | undefined;
  const createCommentMutation = useCreateComment(ticketData?.id || ticketId || "");

  const [commentContent, setCommentContent] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  if (!authLoading && !isAuthenticated) {
    router.replace(`/login?returnUrl=/dashboard/tickets/${ticketId}`);
    return null;
  }

  const handleAddComment = async () => {
    if (!commentContent.trim() || !user?.id || !ticketId) return;

    setCommentError(null);
    try {
      await createCommentMutation.mutateAsync({
        content: commentContent.trim(),
        userId: user.id,
      });
      setCommentContent("");
    } catch (err: any) {
      console.error(err);
      setCommentError(err?.message || "Failed to post comment. Please try again.");
    }
  };

  const handleDownloadAttachment = (attachment: { id: string }) => {
    if (!ticketData) return;
    const baseUrl = (process.env.NEXT_PUBLIC_TICKETING_SERVICE_URL || "/api").replace(
      /\/$/,
      "",
    );
    window.open(
      `${baseUrl}/tickets/${ticketData.id}/attachments/${attachment.id}/download`,
      "_blank",
    );
  };

  const isResolvedOrClosed =
    ticketData?.status === "resolved" || ticketData?.status === "closed";

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full pb-12 space-y-6">
      {/* ── TOP BREADCRUMB / BACK LINK ── */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => router.push("/dashboard/tickets")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to all tickets</span>
        </button>

        {ticketData && (
          <span className="font-mono text-xs text-slate-400 font-medium">
            {ticketData.ticketNumber || `#${ticketData.id.slice(0, 8)}`}
          </span>
        )}
      </div>

      {isLoading || authLoading ? (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-2xs space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-2xs space-y-3">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ) : error || !ticketData ? (
        <Alert className="rounded-2xl border-rose-200 bg-rose-50/50 text-rose-900 p-6">
          <AlertCircle className="h-5 w-5 text-rose-600" />
          <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 sm:mt-0">
            <div>
              <p className="font-semibold text-rose-900">Ticket Not Found</p>
              <p className="text-xs text-rose-700 mt-0.5">
                {error
                  ? "Failed to load ticket details. Please check your connection."
                  : "This support ticket does not exist or may have been removed."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {error && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="rounded-xl text-xs border-rose-200 hover:bg-rose-100/50"
                >
                  Retry
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/tickets")}
                className="rounded-xl text-xs border-slate-200"
              >
                Back to Tickets
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* ── TICKET HERO / HEADER CARD ── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 shadow-2xs">
            {/* Meta Tags Row */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/70">
                {ticketData.ticketNumber || `#${ticketData.id.slice(0, 8)}`}
              </span>
              {renderStatusBadge(ticketData.status)}
              {renderPriorityBadge(ticketData.priority)}
              {ticketData.category && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200/70 capitalize">
                  {ticketData.category.toLowerCase()}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A2530] mb-3 leading-snug">
              {ticketData.title}
            </h1>

            {/* Created Timestamp & Sub-meta */}
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Created on {formatDateTime(ticketData.createdAt)}</span>
              {ticketData.updatedAt && (
                <span className="hidden sm:inline-block text-slate-400">
                  • Last updated {formatDateTime(ticketData.updatedAt)}
                </span>
              )}
            </div>
          </div>

          {/* ── ORIGINAL INQUIRY / DETAILS CARD ── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 shadow-2xs space-y-5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Inquiry Description
              </h2>
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed font-normal">
                  {ticketData.description}
                </p>
              </div>
            </div>

            {/* Labels (if any) */}
            {ticketData.labels && ticketData.labels.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Labels
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {ticketData.labels.map((label) => (
                    <span
                      key={label.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            {ticketData.attachments && ticketData.attachments.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Attached Documents ({ticketData.attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ticketData.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 p-3 bg-slate-50/90 border border-slate-200/70 rounded-xl hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={attachment.filename}>
                            {attachment.filename}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 rounded-lg text-xs font-medium shrink-0 border-slate-200 hover:bg-white gap-1.5"
                        onClick={() => handleDownloadAttachment(attachment)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CONVERSATION TIMELINE ── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Conversation Timeline
                  </h3>
                  <p className="text-xs text-slate-400">
                    Follow updates and discuss details with the support desk
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                {ticketData.comments?.length || 0} replies
              </span>
            </div>

            {/* Comments Stream */}
            <div className="space-y-4">
              {ticketData.comments && ticketData.comments.length > 0 ? (
                ticketData.comments.map((comment) => {
                  const isUser = comment.userId === user?.id;

                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isUser
                          ? "bg-slate-50/90 border-slate-200/80 ml-0 sm:ml-6"
                          : "bg-emerald-50/30 border-emerald-100/90 mr-0 sm:mr-6"
                      }`}
                    >
                      {/* Comment Header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isUser
                                ? "bg-slate-200 text-slate-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {isUser ? (
                              <UserIcon className="w-3.5 h-3.5" />
                            ) : (
                              <Headphones className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            {isUser ? "You" : "Support Specialist"}
                          </span>
                          {!isUser && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                              <ShieldCheck className="w-3 h-3" /> SMC Support
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatDateTime(comment.createdAt)}
                        </span>
                      </div>

                      {/* Comment Content */}
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words pl-8">
                        {comment.content}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs">No replies in this conversation yet.</p>
                </div>
              )}
            </div>

            {/* ── REPLY COMPOSER ── */}
            <div className="pt-2">
              {isResolvedOrClosed ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs sm:text-sm">
                    This ticket has been marked as {ticketData.status}. Further replies are closed. If you still need help, please{" "}
                    <button
                      onClick={() => router.push("/supports")}
                      className="text-emerald-600 hover:underline font-semibold"
                    >
                      create a new support ticket
                    </button>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="reply-content"
                      className="text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      Write a response
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Replies are sent directly to the assigned agent
                    </span>
                  </div>

                  {commentError && (
                    <Alert className="rounded-xl border-rose-200 bg-rose-50 text-rose-900 py-2">
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                      <AlertDescription className="text-xs">{commentError}</AlertDescription>
                    </Alert>
                  )}

                  <Textarea
                    id="reply-content"
                    placeholder="Type your reply here..."
                    value={commentContent}
                    onChange={(e) => {
                      setCommentContent(e.target.value);
                      if (commentError) setCommentError(null);
                    }}
                    rows={3}
                    className="rounded-xl resize-none text-sm border-slate-200 focus-visible:ring-emerald-500 bg-white placeholder:text-slate-400"
                  />

                  <div className="flex justify-end">
                    <Button
                      onClick={handleAddComment}
                      disabled={!commentContent.trim() || createCommentMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 text-xs font-semibold shadow-xs gap-1.5 transition-all"
                    >
                      {createCommentMutation.isPending ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Send Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
