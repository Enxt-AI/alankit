'use client';

import { useSupportAuth } from '@/hooks/use-support-auth';
import { User, Mail, Shield, Clock } from 'lucide-react';
import type { SupportAgent } from '@/types/admin';

export default function SupportProfilePage() {
  const { supportAdmin } = useSupportAuth();

  if (!supportAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <div className="h-12 w-12 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mb-4 border border-[#DC2626]/10">
          <User className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-1">Profile Not Available</h2>
        <p className="text-sm text-[#64748B] max-w-[280px]">Please log in to view your profile settings.</p>
      </div>
    );
  }

  const agent = supportAdmin as SupportAgent;

  const getAvailabilityBadge = (status: string | undefined) => {
    const s = status?.toLowerCase() || 'available';
    if (s === 'available') {
      return 'bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20';
    }
    if (s === 'busy') {
      return 'bg-[#FFFBEB] text-[#D97706] border-[#D97706]/20';
    }
    return 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Profile Settings</h1>
        <p className="text-sm font-medium text-[#64748B] mt-1">
          Manage your account and availability
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Agent Details Card */}
        <div className="p-6 bg-white border border-neutral-200/40 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)] space-y-6">
          <h3 className="text-lg font-semibold text-[#0F172A]">Agent Information</h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-full bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center border border-[#16A34A]/10">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">{agent.fullName}</p>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">Full Name</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-full bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center border border-[#16A34A]/10">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">{agent.email}</p>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">Email Address</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-full bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center border border-[#16A34A]/10">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20">
                  {agent.role}
                </span>
                <p className="text-xs text-[#64748B] font-medium mt-1">Role</p>
              </div>
            </div>
          </div>
        </div>

        {/* Availability Status Card */}
        <div className="p-6 bg-white border border-neutral-200/40 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)] space-y-6">
          <h3 className="text-lg font-semibold text-[#0F172A]">Availability Status</h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-full bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center border border-[#16A34A]/10">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getAvailabilityBadge(agent.availability)}`}>
                  {agent.availability || 'available'}
                </span>
                <p className="text-xs text-[#64748B] font-medium mt-1">Current Status</p>
              </div>
            </div>

            <div className="p-4 bg-[#FAFBFC] rounded-[12px] border border-neutral-200/60">
              <p className="text-xs font-semibold text-[#64748B] leading-relaxed">
                Availability management coming soon. You'll be able to set your status (Available/Busy/Unavailable) and add notes here.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Card */}
      <div className="p-6 bg-white border border-neutral-200/40 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)] space-y-4">
        <h3 className="text-lg font-semibold text-[#0F172A]">Assigned Permissions</h3>
        
        {agent.permissions && agent.permissions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {agent.permissions.map((permission, index) => (
              <span 
                key={index} 
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#FAFBFC] text-[#0F172A] border border-neutral-200/60"
              >
                {permission}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#64748B]">No permissions assigned to this agent role.</p>
        )}
      </div>
    </div>
  );
}