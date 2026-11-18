"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  CreditCard,
  Landmark,
  User,
  Users,
  FileText,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Copy,
  Check,
  Eye,
  EyeOff,
  MapPin,
} from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  // Local state for interactive features
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [copiedBoId, setCopiedBoId] = useState(false);
  const [showRedoKycModal, setShowRedoKycModal] = useState(false);

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?returnUrl=/profile");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const kycData = user?.kycData as any;
  const aadhaar = kycData?.aadhaarDetails;
  const pan = kycData?.panDetails;

  // Resolve data fields. Never fall back to hardcoded sample PII — a user who
  // hasn't completed KYC must see a neutral empty state, not someone's data.
  const NOT_AVAILABLE = "Not available";
  const email = user?.email || NOT_AVAILABLE;
  const phone = user?.phone || NOT_AVAILABLE;
  const dob = kycData?.dob || pan?.dob || NOT_AVAILABLE;
  const gender = aadhaar?.gender || kycData?.gender || NOT_AVAILABLE;
  const careOf = kycData?.fatherName || (kycData as any)?.careOf || aadhaar?.fatherName || (aadhaar as any)?.careOf || NOT_AVAILABLE;
  const panNumber = pan?.pan || kycData?.pan || NOT_AVAILABLE;

  const rawAadhaarNumber =
    aadhaar?.aadhaar && aadhaar?.aadhaar !== "FETCHED_AADHAAR"
      ? String(aadhaar.aadhaar)
      : kycData?.digitapDetails?.maskedAdharNumber || "";
  const hasAadhaar = rawAadhaarNumber.length >= 4;

  const maskedAadhaar = hasAadhaar
    ? `********${rawAadhaarNumber.slice(-4)}`
    : NOT_AVAILABLE;

  const fullAadhaar =
    rawAadhaarNumber.length >= 12 ? rawAadhaarNumber : "";

  const boId = user?.dematData?.accountNumber || "";
  const hasBoId = boId.length > 0;

  // Address resolution
  const rawAddress = kycData?.address || aadhaar?.address;
  const address =
    typeof rawAddress === "object"
      ? Object.values(rawAddress || {}).filter(Boolean).join(", ")
      : rawAddress;

  // Avatar source
  const aadhaarPhoto = aadhaar?.photo;
  const avatarSrc = aadhaarPhoto
    ? aadhaarPhoto.startsWith("data:")
      ? aadhaarPhoto
      : `data:image/jpeg;base64,${aadhaarPhoto}`
    : undefined;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBoId(true);
    setTimeout(() => setCopiedBoId(false), 2000);
  };

  const isKycVerified = user?.kycStatus === "VERIFIED";
  const isDematVerified = user?.dematStatus === "VERIFIED";
  const isDematRejected = user?.dematStatus === "REJECTED";
  const isDematSubmitted = user?.dematStatus === "PENDING" && Boolean(user?.dematData?.submittedAt);
  const dematBadge = isDematVerified
    ? { label: "Verified", card: "border-slate-200/80 cursor-default", icon: "bg-green-50 border-green-100", text: "text-green-600" }
    : isDematRejected
      ? { label: "Rejected", card: "border-red-200 hover:border-red-400 hover:shadow-md cursor-pointer", icon: "bg-red-50 border-red-100", text: "text-red-600" }
      : isDematSubmitted
        ? { label: "Submitted", card: "border-blue-200 hover:border-blue-400 hover:shadow-md cursor-pointer", icon: "bg-blue-50 border-blue-100", text: "text-blue-600" }
        : { label: "Verify Now", card: "border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer", icon: "bg-amber-50 border-amber-100", text: "text-amber-600" };

  const isBankVerified = user?.bankStatus === "VERIFIED";

  return (
    <div className="min-h-screen">
      <div className="max-w-[1120px] mx-auto">

        {/* ── 1. USER PROFILE HEADER CARD (EXACT MATCH TO DESIGN MOCKUP) ── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs mb-6 overflow-hidden">
          {/* Top Wavy Banner Background */}
          <div className="relative h-24 sm:h-32 w-full overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 300"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="profileBgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#e8f5e9" />
                  <stop offset="50%" stopColor="#f0fdf4" />
                  <stop offset="100%" stopColor="#e0f2fe" />
                </linearGradient>
              </defs>
              <rect width="1000" height="300" fill="url(#profileBgGrad)" />
              <path
                d="M0,140 C280,240 720,60 1000,160 L1000,300 L0,300 Z"
                fill="#ffffff"
              />
            </svg>
          </div>

          {/* Avatar & Info Content Section */}
          <div className="px-4 sm:px-6 pb-6 pt-0 flex flex-col items-center text-center -mt-10 sm:-mt-14 relative z-10">
            {/* Centered Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 sm:border-4 border-white shadow-md rounded-full">
                {avatarSrc ? (
                  <AvatarImage src={avatarSrc} alt={user?.fullName || "User"} />
                ) : (
                  <AvatarImage src="/profile.png" />
                )}
                <AvatarFallback className="text-xl font-extrabold bg-emerald-100 text-emerald-800">
                  {user?.fullName?.charAt(0) ?? "A"}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* User Name */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A2530] mt-3.5 tracking-tight">
              {user?.fullName ?? "User"}
            </h1>

            {/* 3 Status Badges Side-By-Side (KYC, DEMAT, BANK) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 w-full max-w-xl">
              {/* KYC Status Card */}
              <button
                type="button"
                onClick={() => !isKycVerified && router.push("/kyc")}
                className={`border rounded-2xl p-2 sm:p-3.5 flex items-center justify-center gap-1.5 sm:gap-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-all ${
                  isKycVerified
                    ? "bg-white border-slate-200/80 cursor-default"
                    : "bg-white border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer"
                }`}
              >
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${isKycVerified ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                  <ShieldCheck className={`w-4 h-4 sm:w-5 sm:h-5 ${isKycVerified ? 'text-green-600' : 'text-amber-600'}`} strokeWidth={2.2} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] sm:text-xs font-extrabold text-slate-900 tracking-wide">KYC</span>
                  <span className={`text-[9px] sm:text-xs font-bold ${isKycVerified ? 'text-green-600' : 'text-amber-600'}`}>
                    {isKycVerified ? "Verified" : "Verify Now"}
                  </span>
                </div>
              </button>

              {/* DEMAT Status Card */}
              <button
                type="button"
                onClick={() => !isDematVerified && router.push("/demat")}
                aria-label={`Demat: ${dematBadge.label}`}
                className={`bg-white border rounded-2xl p-2 sm:p-3.5 flex items-center justify-center gap-1.5 sm:gap-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-all ${dematBadge.card}`}
              >
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${dematBadge.icon}`}>
                  <ShieldCheck className={`w-4 h-4 sm:w-5 sm:h-5 ${dematBadge.text}`} strokeWidth={2.2} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] sm:text-xs font-extrabold text-slate-900 tracking-wide">DEMAT</span>
                  <span className={`text-[9px] sm:text-xs font-bold ${dematBadge.text}`}>
                    {dematBadge.label}
                  </span>
                </div>
              </button>

              {/* BANK Status Card */}
              <button
                type="button"
                onClick={() => !isBankVerified && router.push("/bank")}
                className={`border rounded-2xl p-2 sm:p-3.5 flex items-center justify-center gap-1.5 sm:gap-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-all ${
                  isBankVerified
                    ? "bg-white border-slate-200/80 cursor-default"
                    : "bg-white border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer"
                }`}
              >
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${isBankVerified ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                  <Landmark className={`w-4 h-4 sm:w-5 sm:h-5 ${isBankVerified ? 'text-green-600' : 'text-amber-600'}`} strokeWidth={2.2} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] sm:text-xs font-extrabold text-slate-900 tracking-wide">BANK</span>
                  <span className={`text-[9px] sm:text-xs font-bold ${isBankVerified ? 'text-green-600' : 'text-amber-600'}`}>
                    {isBankVerified ? "Verified" : "Verify Now"}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── 2. PERSONAL INFORMATION CARD ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs mb-6">
          
          {/* Header Row */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-[#1A2530]">Personal Information</h2>
              <div className="w-6 h-0.5 bg-green-600 rounded-full mt-1.5" />
            </div>

            <button
              type="button"
              onClick={() => setShowRedoKycModal(true)}
              className="border border-slate-200/90 rounded-lg px-3 py-1.5 text-green-600 font-semibold text-xs hover:bg-slate-50 flex items-center gap-1.5 bg-white transition-all cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-green-600" />
              Edit Profile
            </button>
          </div>

          {/* 8 Field Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 mt-5">
            
            {/* 1. Email Address */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <Mail className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">Email Address</p>
                <p className="text-xs sm:text-sm font-bold text-[#1A2530] truncate">{email}</p>
              </div>
            </div>

            {/* 2. Phone Number */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <Phone className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">Phone Number</p>
                <p className="text-xs sm:text-sm font-bold text-[#1A2530] truncate">{phone}</p>
              </div>
            </div>

            {/* 3. Date of Birth */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <Calendar className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">Date of Birth</p>
                <p className="text-xs sm:text-sm font-bold text-[#1A2530] truncate">{dob}</p>
              </div>
            </div>

            {/* 4. Gender */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <User className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">Gender</p>
                <p className="text-xs sm:text-sm font-bold text-[#1A2530] truncate">{gender}</p>
              </div>
            </div>

            {/* 5. Care Of */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <Users className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">Care Of</p>
                <p className="text-xs sm:text-sm font-bold text-[#1A2530] truncate">{careOf}</p>
              </div>
            </div>

            {/* 6. PAN Number */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <CreditCard className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">PAN Number</p>
                <p className="text-xs sm:text-sm font-bold text-[#1A2530] font-mono tracking-wide truncate">{panNumber}</p>
              </div>
            </div>

            {/* 7. Aadhaar Number with Eye Toggle */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <ShieldCheck className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-0.5">Aadhaar Number</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1A2530] font-mono tracking-wider">
                    {showAadhaar && fullAadhaar ? fullAadhaar : maskedAadhaar}
                  </p>
                </div>
                {hasAadhaar && (
                  <button
                    type="button"
                    onClick={() => setShowAadhaar(!showAadhaar)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
                    title={showAadhaar ? "Hide Aadhaar" : "Show Aadhaar"}
                  >
                    {showAadhaar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* 8. BO ID (Demat Account) with Copy Button */}
            <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <FileText className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-0.5">BO ID (Demat Account)</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1A2530] font-mono tracking-wide truncate">
                    {hasBoId ? boId : "Not linked"}
                  </p>
                </div>
                {hasBoId && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(boId)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer ml-2 shrink-0"
                    title="Copy BO ID"
                  >
                    {copiedBoId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Address Row if available */}
          {address && (
            <div className="mt-4 bg-white border border-slate-200/70 rounded-xl p-3.5 flex items-center gap-3 hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                <MapPin className="w-4 h-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5">Address</p>
                <p className="text-xs sm:text-sm font-bold text-[#1A2530] leading-relaxed break-words">{address}</p>
              </div>
            </div>
          )}
        </div>


      </div>

      {/* ── REDO KYC POPUP DIALOG ── */}
      <AlertDialog open={showRedoKycModal} onOpenChange={setShowRedoKycModal}>
        <AlertDialogContent className="rounded-2xl max-w-md p-6 bg-white border border-slate-200">
          <AlertDialogHeader className="items-center text-center sm:text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center mb-2 mx-auto">
              <ShieldCheck className="w-7 h-7 text-green-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-[#1A2530]">
              Re-verify KYC to Update Profile
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed mt-1">
              To update your verified personal information (Name, DOB, Address, PAN, or Aadhaar), SEBI & compliance regulations require re-verifying your identity via DigiLocker.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs text-slate-700 my-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="font-medium">Takes less than 1 minute via DigiLocker</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="font-medium">Updates all verified profile & KYC records</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="font-medium">Maintains full compliance & account security</span>
            </div>
          </div>

          <AlertDialogFooter className="sm:justify-stretch gap-2.5 mt-3 flex-col-reverse sm:flex-row">
            <AlertDialogCancel className="w-full rounded-xl border-slate-200 font-semibold text-xs h-10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => router.push("/kyc?redo=true")}
              className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-10 shadow-sm"
            >
              Redo KYC & Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
