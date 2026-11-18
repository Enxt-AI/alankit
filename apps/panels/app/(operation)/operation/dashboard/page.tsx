"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

// Store & Components
import { useNSDLStore } from "@/store/nsdl-store";
import { useAuthStore } from "@/store/auth-store";
import GlassTooltip from "@/components/operation/nsdl/shared/GlassTooltip";
import WizardProgress from "@/components/operation/nsdl/shared/WizardProgress";
import UploadStep from "@/components/operation/nsdl/UploadStep";
import MappingStep from "@/components/operation/nsdl/mapping";
import ReviewStep from "@/components/operation/nsdl/review";

export default function Home() {
  const { operationAdmin } = useAuthStore();
  const isSuperAdmin = operationAdmin?.role === 'SUPER_ADMIN';
  const hasNsdlBatch = operationAdmin?.permissions?.includes('nsdl_batch') || isSuperAdmin;

  const currentStep = useNSDLStore((state) => state.currentStep);
  const hasErrors = useNSDLStore((state) => state.hasErrors());
  const tooltip = useNSDLStore((state) => state.tooltip);
  const mode = useNSDLStore((state) => state.mode);
  const showExcelMapping = useNSDLStore((state) => state.showExcelMapping);
  const parsedData = useNSDLStore((state) => state.parsedData);

  if (!hasNsdlBatch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="rounded-full bg-amber-50 p-4 border border-amber-200/60 mb-4">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium text-[#64748B] mt-2 max-w-md">
          You do not have the <span className="font-semibold text-neutral-800">NSDL Batch</span> permission required to access batch processing.
        </p>
      </div>
    );
  }

  // Mock Operational Metrics for Dashboard Stats
  const metrics = [
    { label: "Files Processed Today", value: "14", icon: FileText },
    { label: "Pending Validation", value: "2", icon: AlertCircle },
    { label: "Successful Imports", value: "1,420", icon: CheckCircle2 },
    { label: "Failed Records", value: "3", icon: XCircle },
  ];

  return (
    <div className="flex-1 space-y-6 p-6">
      <GlassTooltip tooltip={tooltip} />

      {/* Compact Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
          NSDL Batch Processing
        </h1>
        <p className="text-sm font-medium text-[#64748B]">
          Upload, validate and process NSDL batch files.
        </p>
      </div>

      {/* Step Progress Stepper */}
      <WizardProgress currentStep={currentStep} hasErrors={hasErrors} />

      {/* Wizard Workspace Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.99, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.99, y: -10 }}
          transition={{ type: "spring", damping: 30, stiffness: 250 }}
          className="relative bg-white border border-neutral-200/40 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden min-h-[400px]"
        >
          {currentStep === 1 && <UploadStep />}

          {currentStep === 2 &&
            mode === "excel-to-batch" &&
            showExcelMapping && <MappingStep />}

          {currentStep === 3 && parsedData && <ReviewStep />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
