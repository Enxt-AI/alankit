import React from 'react';
import { Check, ShieldAlert } from 'lucide-react';

interface WizardProgressProps {
  currentStep: number;
  hasErrors: boolean;
}

const WizardProgress: React.FC<WizardProgressProps> = ({ currentStep, hasErrors }) => {
  const steps = [
    { id: 1, name: 'Source', desc: 'Secure file upload' },
    { id: 2, name: 'Mapping', desc: 'Schema mapping sync' },
    { id: 3, name: 'Verify', desc: 'Final validation review' },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 bg-white border border-neutral-200/40 rounded-[20px] p-4 shadow-[0_8px_30px_rgba(15,23,42,0.02)]">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <React.Fragment key={step.id}>
              {/* Step Item */}
              <div className="flex items-center gap-3 flex-1">
                {/* Step circle */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20'
                      : isActive
                        ? hasErrors
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-[#DCFCE7] text-[#16A34A] border border-[#16A34A]/30 ring-4 ring-[#16A34A]/10'
                        : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-[#16A34A]" />
                  ) : isActive && hasErrors ? (
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>

                {/* Step texts */}
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold tracking-tight uppercase leading-none ${
                      isActive ? 'text-[#0F172A]' : 'text-[#64748B]'
                    }`}
                  >
                    {step.name}
                  </p>
                  <p className="text-[10px] font-medium text-[#64748B]/70 truncate mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>

              {/* Connecting arrow/line */}
              {idx < steps.length - 1 && (
                <div className="hidden sm:block w-8 h-[2px] bg-neutral-200/50 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WizardProgress;
