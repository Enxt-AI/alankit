'use client';

import React, { useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners, useDraggable, useDroppable, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { IndianRupee, GripVertical, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadAnalytics } from '@/lib/marketing-api';

interface LeadKanbanBoardProps {
  leads: LeadAnalytics[];
  onStatusChange?: (leadId: string, status: string) => void;
}

const COLUMNS = [
  { id: 'NEW', title: 'New' },
  { id: 'CONTACTED', title: 'Contacted' },
  { id: 'QUALIFIED', title: 'Qualified' },
  { id: 'CONVERTED', title: 'Converted' },
  { id: 'LOST', title: 'Lost' },
];

const kycPill: Record<string, string> = {
  VERIFIED: 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20',
  REJECTED: 'bg-[#FEF2F2] text-[#DC2626] border-[#EF4444]/20',
};

function DraggableLeadCard({ lead }: { lead: LeadAnalytics }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)', ...style }}
      {...attributes}
      {...listeners}
      className={cn(
        "group bg-white rounded-[20px] border border-neutral-200/40 p-4 cursor-grab active:cursor-grabbing transition-all duration-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
        isDragging && "ring-2 ring-[#16A34A]/30 shadow-lg"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10 text-xs font-bold text-[#16A34A]">
          {(lead.name || 'U').substring(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#0F172A]">{lead.name || 'Unknown Name'}</span>
          <span className="block truncate font-mono text-[10px] text-[#64748B]">#{lead.clientId}</span>
        </span>
        <GripVertical className="h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-200/40 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0F172A]">
          <IndianRupee className="h-3 w-3 text-[#64748B]" />
          {Number(lead.transactionValue || 0).toLocaleString('en-IN')}
        </span>
        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold border whitespace-nowrap", kycPill[lead.kycStatus] ?? 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/20')}>
          {lead.kycStatus}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-[#64748B]">
        {lead.transactionCount} txns • {lead.sharesRequested} shares
      </p>
    </div>
  );
}

function DroppableColumn({ id, title, leads }: { id: string; title: string; leads: LeadAnalytics[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className={cn("flex w-[288px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-neutral-200/40 bg-white transition-colors", isOver && "border-[#16A34A]/40 bg-[#ECFDF5]/40")}>
      <div className="flex items-center gap-2 border-b border-neutral-200/40 bg-[#FAFBFC] px-4 py-3.5">
        <h3 className="flex-1 text-[13px] font-bold text-[#0F172A]">{title}</h3>
        <span className="rounded-lg bg-white border border-neutral-200/60 px-2 py-0.5 text-[11px] font-bold text-[#64748B]">{leads.length}</span>
      </div>
      <div ref={setNodeRef} className="flex min-h-[480px] max-h-[520px] overflow-y-auto flex-col gap-3 p-3">
        {leads.map(lead => <DraggableLeadCard key={lead.id} lead={lead} />)}
        {leads.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200/60 bg-[#FAFBFC] py-10 text-center">
            <Inbox className="h-6 w-6 text-neutral-300" />
            <p className="text-[11px] font-semibold text-[#64748B]">Drop leads here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadKanbanBoard({ leads, onStatusChange }: LeadKanbanBoardProps) {
  const [activeLead, setActiveLead] = React.useState<LeadAnalytics | null>(null);

  const groupedLeads = useMemo(() => {
    const groups: Record<string, LeadAnalytics[]> = { NEW: [], CONTACTED: [], QUALIFIED: [], CONVERTED: [], LOST: [] };
    leads.forEach(lead => {
      const status = lead.status || 'NEW';
      if (groups[status]) groups[status]!.push(lead);
      else groups['NEW']!.push(lead);
    });
    for (const key of Object.keys(groups)) {
      groups[key]!.sort((a, b) => {
        const at = (v: unknown) => { const t = new Date((v as any) ?? 0).getTime(); return Number.isNaN(t) ? 0 : t; };
        return at((b as any).lastActivityAt) - at((a as any).lastActivityAt);
      });
    }
    return groups;
  }, [leads]);

  const handleDragStart = (event: DragStartEvent) => {
    const lead = event.active.data.current?.lead as LeadAnalytics;
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;
    const leadId = active.id as string;
    const newStatus = over.id as string;
    const lead = active.data.current?.lead as LeadAnalytics;
    if (lead && lead.status !== newStatus && Object.keys(groupedLeads).includes(newStatus)) {
      onStatusChange?.(leadId, newStatus);
    }
  };

  return (
    <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {COLUMNS.map(col => (
          <DroppableColumn key={col.id} id={col.id} title={col.title} leads={groupedLeads[col.id] || []} />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="rotate-2 opacity-90 shadow-xl"><DraggableLeadCard lead={activeLead} /></div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
