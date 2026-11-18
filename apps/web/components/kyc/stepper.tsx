import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  label: string;
  description?: string;
}

interface StepperProps {
  currentStep: number;
  steps: StepItem[];
}

export function Stepper({ currentStep, steps }: StepperProps) {
  return (
    <div className="w-full py-4 sm:py-6">
      {/* Desktop horizontal stepper */}
      <div className="hidden md:flex items-center justify-between max-w-4xl mx-auto">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-all duration-300 shadow-sm",
                    isCompleted && "bg-emerald-600 text-white scale-100",
                    isActive &&
                      "bg-white text-emerald-600 ring-2 ring-emerald-600 scale-110 shadow-emerald-200",
                    isPending && "bg-gray-100 text-gray-400",
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6 stroke-[3px]" />
                  ) : (
                    <span className="text-lg">{index + 1}</span>
                  )}
                </div>
                <div className="absolute top-14 w-32 text-center">
                  <p
                    className={cn(
                      "text-sm font-bold tracking-tight transition-colors duration-300",
                      isActive && "text-emerald-700",
                      isCompleted && "text-emerald-600",
                      isPending && "text-gray-400",
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4 relative h-1 bg-gray-100 rounded-full overflow-hidden min-w-[100px]">
                  <div
                    className={cn(
                      "absolute inset-0 bg-emerald-600 transition-all duration-500 ease-in-out",
                      index < currentStep
                        ? "translate-x-0"
                        : "-translate-x-full",
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile horizontal stepper (compact for phone screens) */}
      <div className="flex md:hidden flex-col bg-white/90 backdrop-blur-md border border-slate-100 rounded-2xl p-3.5 shadow-sm">
        {/* Nodes & Connector Lines Row */}
        <div className="flex items-center justify-between px-6">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isPending = index > currentStep;

            return (
              <React.Fragment key={index}>
                {/* Node Circle */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border bg-white shrink-0 z-10",
                    isCompleted && "bg-emerald-500 border-transparent text-white shadow-sm scale-100",
                    isActive && "border-2 border-emerald-500 text-emerald-600 bg-white ring-2 ring-emerald-100 scale-105",
                    isPending && "border-slate-200 text-slate-400 bg-slate-50/50"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3px]" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Connector Line (between nodes) */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-3">
                    <div
                      className={cn(
                        "h-0.5 w-full transition-all duration-500 ease-in-out",
                        index < currentStep ? "bg-emerald-500" : "bg-slate-200"
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Labels Row */}
        <div className="flex justify-between items-start mt-2 text-center">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isPending = index > currentStep;

            return (
              <div key={index} className="flex-1 px-1 flex flex-col items-center">
                <p
                  className={cn(
                    "text-[10px] sm:text-xs font-bold tracking-tight leading-tight mt-0.5 text-center whitespace-normal break-words",
                    isActive && "text-slate-900 font-extrabold",
                    isCompleted && "text-emerald-600",
                    isPending && "text-slate-400"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-[9px] text-slate-400 font-medium leading-tight mt-0.5 text-center whitespace-normal">
                    {step.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
