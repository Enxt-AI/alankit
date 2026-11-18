"use client";

import { Loader2, Download, Paperclip } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface Attachment {
  name: string;
  size: number;
}

interface DocumentAttachmentsButtonProps {
  cin: string;
  docId: string;
}

export function DocumentAttachmentsButton({ cin, docId }: DocumentAttachmentsButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: attachments, isFetching, error, refetch } = useQuery<Attachment[]>({
    queryKey: ["document-attachments", cin, docId],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/company/${encodeURIComponent(cin)}/documents/attachments?docId=${encodeURIComponent(docId)}`);
      if (!res.ok) {
        throw new Error("Failed to fetch attachments");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: expanded,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="mt-3 text-sm text-indigo-700 underline">
        View attachments
      </button>
    );
  }

  if (isFetching) {
    return (
      <div className="w-full mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading attachments...
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="mt-3 text-sm text-red-600">
        Could not load attachments.{' '}
        <button type="button" onClick={() => void refetch()} className="underline">Try again</button>
      </div>
    );
  }

  if (!attachments || attachments.length === 0) {
    return <p className="mt-3 text-sm text-gray-500">No attachments in this document.</p>;
  }

  return (
    <div className="w-full mt-4 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
        <Paperclip className="h-4 w-4" />
        Document Attachments
      </div>
      <div className="flex flex-col gap-2">
        {attachments.map((attachment) => (
          <a
            key={attachment.name}
            href={`/api/stocks/company/${encodeURIComponent(cin)}/documents/attachment?docId=${encodeURIComponent(docId)}&attachmentName=${encodeURIComponent(attachment.name)}`}
            download={attachment.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 sm:p-3.5 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 hover:border-gray-200 transition-colors w-full group"
          >
            <div className="flex flex-col overflow-hidden mr-3 text-left">
              <span className="truncate text-[13px] sm:text-sm font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">{attachment.name}</span>
              <span className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5">{formatSize(attachment.size)}</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-gray-200 text-gray-400 shrink-0 shadow-sm group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
              <Download className="h-4 w-4" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
