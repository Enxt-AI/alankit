"use client";

import { useEffect, useState } from "react";
import { UserCircle, Mail, Briefcase, ShieldCheck, ArrowLeft, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePortalProfile, type BranchClassificationDetails } from "@/hooks/use-profile";

type ClassificationKey = Exclude<keyof BranchClassificationDetails, "classification" | "classificationLabel">;

// Mirrors the admin panel's classification options (apps/panels/lib/branch-classification.ts)
const CLASSIFICATION_CONFIG: Record<string, { label: string; accent: string; fields: { key: ClassificationKey; label: string }[] }> = {
  EQUITY: {
    label: "Equity",
    accent: "#16A34A",
    fields: [
      { key: "zone", label: "Zone" },
      { key: "zonalHead", label: "Zonal Head" },
      { key: "areaManager", label: "Area Manager" },
      { key: "branchManager", label: "Branch Manager" },
    ],
  },
  DISTRIBUTION: {
    label: "Distribution",
    accent: "#3B82F6",
    fields: [
      { key: "territory", label: "Territory" },
      { key: "territoryHead", label: "Territory Head" },
    ],
  },
  WEALTH: { label: "Wealth", accent: "#8B5CF6", fields: [{ key: "reportingManager", label: "Reporting Manager" }] },
  STOXKART: { label: "Stoxkart", accent: "#F59E0B", fields: [{ key: "reportingManager", label: "Reporting Manager" }] },
  OTHER: { label: "Other", accent: "#EC4899", fields: [{ key: "reportingManager", label: "Reporting Manager" }] },
};

export default function ProfilePage() {
  const [userType, setUserType] = useState<string>("branch");

  useEffect(() => {
    setUserType(localStorage.getItem("userType") || "branch");
  }, []);

  const { data: profile, isLoading, error } = usePortalProfile((userType === "branch" ? "branch" : "distributor"));
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading profile data...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-6 bg-white rounded-xl border border-slate-200 shadow-sm mt-8">
        <h3 className="text-base font-semibold text-rose-600">Unable to load your profile</h3>
        <p className="mt-1 text-sm text-slate-500">
          We couldn&apos;t retrieve your profile information. This may be due to a session timeout or a temporary issue. Please try logging in again.
        </p>
        <button 
          onClick={() => router.push("/login/distributor?clear=true")} 
          className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all cursor-pointer"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">Profile & Account</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
              Active Account
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 whitespace-nowrap">
            View your branch profile settings and assigned network credentials.
          </p>
        </div>

        <Link
          href="/branch"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Profile Card */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200/90 overflow-hidden">
        <div className="p-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <div className="h-24 w-24 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
              <span className="text-3xl text-emerald-700 font-bold tracking-tight">
                {profile.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            
            {/* Fields Grid */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 whitespace-nowrap">
                    <UserCircle className="w-3.5 h-3.5 text-slate-400" /> Full Name
                  </span>
                  <div className="bg-slate-50/70 px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 font-medium text-sm whitespace-nowrap">
                    {profile.name}
                  </div>
                </div>
                
                {/* Email Address */}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 whitespace-nowrap">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
                  </span>
                  <div className="bg-slate-50/70 px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 font-medium text-sm whitespace-nowrap">
                    {profile.email}
                  </div>
                </div>
                
                {/* Branch / Network Name */}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 whitespace-nowrap">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" /> Branch Name / Location
                  </span>
                  <div className="bg-slate-50/70 px-3.5 py-2.5 rounded-lg border border-slate-200 text-emerald-700 font-medium text-sm whitespace-nowrap">
                    {profile.branchName || "SMC Global Securities Ltd."}
                  </div>
                </div>

                {/* Role Designation */}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 whitespace-nowrap">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Account Type
                  </span>
                  <div className="bg-slate-50/70 px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium text-sm whitespace-nowrap">
                    SMC Branch Administration
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Classification Card */}
      {userType === "branch" && (() => {
        const details = profile.classification;
        const config = details?.classification ? CLASSIFICATION_CONFIG[details.classification] : undefined;
        const typeLabel =
          details?.classification === "OTHER" && details.classificationLabel ? details.classificationLabel : config?.label;
        return (
          <div className="bg-white shadow-sm rounded-xl border border-slate-200/90 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-900">Classification</h2>
              </div>
              {config && (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide"
                  style={{ backgroundColor: `${config.accent}1A`, color: config.accent }}
                >
                  {typeLabel}
                </span>
              )}
            </div>
            <div className="p-8">
              {!config ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                  No classification has been assigned to this branch yet. Please contact your administrator.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {config.fields.map((field) => (
                    <div key={field.key} className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 whitespace-nowrap">
                        {field.label}
                      </span>
                      <div className="bg-slate-50/70 px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 font-medium text-sm">
                        {details?.[field.key] || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
