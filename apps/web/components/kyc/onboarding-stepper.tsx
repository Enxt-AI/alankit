import React from "react";
import { Check, ShieldCheck, Briefcase, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingStepItem {
  label: string;
  description?: string;
  icon: React.ComponentType<any>;
}

interface OnboardingStepperProps {
  currentStep: number; // 0 for KYC, 1 for Demat, 2 for Bank
}

const onboardingSteps: OnboardingStepItem[] = [
  { label: "KYC Verification", description: "PAN & Aadhaar", icon: ShieldCheck },
  { label: "Demat Account", description: "Link BO ID", icon: Briefcase },
  { label: "Bank Account", description: "Add payout details", icon: Building2 },
];

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  // Progress percentage for connector line between circle centers
  // Step 0: 0%, Step 1: 50%, Step 2: 100%
  const progressPercent =
    currentStep <= 0 ? 0 : currentStep === 1 ? 50 : 100;

  return (
    <div className="w-full py-4 sm:py-6 px-2 sm:px-4 mb-6 sm:mb-8 max-w-3xl mx-auto">
      <div className="relative">
        {/* Continuous Connector Bar (behind circle nodes, connecting center of step 1 to center of step 3) */}
        <div
          className="absolute top-5 sm:top-6 left-[16.666%] right-[16.666%] h-[2px] bg-slate-200 -translate-y-1/2 z-0"
          aria-hidden="true"
        >
          {/* Active progress fill */}
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 3-Column Steps Grid */}
        <div className="grid grid-cols-3 relative z-10">
          {onboardingSteps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isPending = index > currentStep;
            const StepIcon = step.icon;

            return (
              <div
                key={index}
                className="flex flex-col items-center text-center px-1 sm:px-2"
              >
                {/* Circle Node */}
                <div
                  className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 bg-white shrink-0",
                    isCompleted &&
                      "bg-emerald-500 text-white shadow-sm border-2 border-emerald-500 ring-4 ring-emerald-50",
                    isActive &&
                      "border-2 border-emerald-500 text-emerald-600 bg-white ring-4 ring-emerald-100 shadow-sm scale-105",
                    isPending && "border-2 border-slate-200 text-slate-400 bg-white"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5px] animate-in zoom-in duration-300" />
                  ) : (
                    <StepIcon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2px]" />
                  )}
                </div>

                {/* Labels */}
                <div className="mt-2.5 sm:mt-3 flex flex-col items-center">
                  <span
                    className={cn(
                      "text-[10px] sm:text-[11px] font-extrabold tracking-widest uppercase transition-colors duration-200",
                      isPending ? "text-slate-400" : "text-emerald-600"
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h4
                    className={cn(
                      "text-xs sm:text-sm font-bold tracking-tight mt-0.5 transition-colors duration-200",
                      isActive && "text-slate-900",
                      isCompleted && "text-emerald-700",
                      isPending && "text-slate-400"
                    )}
                  >
                    {step.label}
                  </h4>
                  {step.description && (
                    <p className="text-[10px] sm:text-xs text-slate-500 font-normal mt-0.5 max-w-[120px] sm:max-w-none">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


