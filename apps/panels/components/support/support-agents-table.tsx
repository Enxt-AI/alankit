'use client';

import { useMemo } from 'react';
import { SupportAgent } from '@/types/admin';

interface SupportAgentsTableProps {
  agents: SupportAgent[];
  isLoading: boolean;
}

export function SupportAgentsTable({ agents, isLoading }: SupportAgentsTableProps) {
  const activeAgentsCount = useMemo(() => agents.filter((a) => a.isActive !== false).length, [agents]);
  const totalTicketsAssigned = useMemo(
    () => agents.reduce((acc, agent) => acc + (agent.activeTicketCount || 0), 0),
    [agents]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-neutral-200/40 shadow-sm">
        <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-[#16A34A] animate-spin" />
        <p className="mt-4 text-sm font-medium text-neutral-500">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-neutral-200/40 shadow-sm flex flex-col gap-1">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Agents</span>
          <span className="text-2xl font-black text-[#0F172A]">{agents.length}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-neutral-200/40 shadow-sm flex flex-col gap-1">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Active Agents</span>
          <span className="text-2xl font-black text-[#16A34A]">{activeAgentsCount}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-neutral-200/40 shadow-sm flex flex-col gap-1">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Tickets Assigned</span>
          <span className="text-2xl font-black text-[#2563EB]">{totalTicketsAssigned}</span>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/40 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFBFC] border-b border-neutral-200/40">
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Agent Details</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Status & Availability</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Active Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/40">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm font-medium text-neutral-500">
                    No agents found.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-[#0F172A]">{agent.fullName || 'Unknown Name'}</span>
                        <span className="text-xs text-neutral-500">{agent.email}</span>
                        {/* phone would go here if Admin had it, wait Admin type doesn't have phone */}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {agent.isActive !== false ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20">
                            Active Account
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200">
                            Inactive
                          </span>
                        )}

                        {agent.availability === 'available' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#16A34A]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                            Available
                          </span>
                        )}
                        {agent.availability === 'busy' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D97706]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
                            Busy
                          </span>
                        )}
                        {agent.availability === 'unavailable' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                            Unavailable
                          </span>
                        )}
                        {agent.availabilityNote && (
                          <span className="text-[10px] italic text-neutral-500 block max-w-xs truncate" title={agent.availabilityNote}>
                            "{agent.availabilityNote}"
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] h-8 px-3 rounded-full bg-[#EFF6FF] text-[#2563EB] font-black text-sm border border-[#2563EB]/20">
                        {agent.activeTicketCount || 0}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
