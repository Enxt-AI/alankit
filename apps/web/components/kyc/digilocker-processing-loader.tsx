import React from "react";
import { ShieldCheck, FileText, UserCheck, CheckCircle2 } from "lucide-react";

const steps = [
  { icon: ShieldCheck, label: "Connecting to DigiLocker" },
  { icon: FileText, label: "Fetching your documents" },
  { icon: UserCheck, label: "Verifying identity records" },
  { icon: CheckCircle2, label: "Preparing your profile" },
];

export function DigiLockerProcessingLoader() {
  const [activeStep, setActiveStep] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center px-6 max-w-sm w-full text-center">
        {/* Animated ring + logo */}
        <div className="relative mb-10">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-40 scale-110" />
          {/* Middle ring */}
          <div className="absolute inset-0 rounded-full border-4 border-blue-100 scale-[1.18]" />
          {/* Spinning arc */}
          <svg
            className="absolute inset-0 -rotate-90 animate-spin"
            style={{ animationDuration: "1.4s" }}
            viewBox="0 0 88 88"
            width="88"
            height="88"
          >
            <circle
              cx="44"
              cy="44"
              r="40"
              fill="none"
              stroke="#0C1A97"
              strokeWidth="4"
              strokeDasharray="251"
              strokeDashoffset="188"
              strokeLinecap="round"
            />
          </svg>
          {/* Icon center */}
          <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-[#0C1A97] to-[#3B5BDB] flex items-center justify-center shadow-2xl shadow-blue-900/30">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
          Fetching your data
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-10">
          We're securely retrieving your verified PAN &amp; Aadhaar details from DigiLocker. This takes a moment—please don't close this page.
        </p>

        {/* Step pills */}
        <div className="w-full space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isDone = index < activeStep;
            const isActive = index === activeStep;
            return (
              <div
                key={index}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-500
                  ${isActive
                    ? "bg-blue-50 border-blue-200 shadow-sm shadow-blue-100"
                    : isDone
                    ? "bg-emerald-50 border-emerald-100"
                    : "bg-gray-50/60 border-gray-100 opacity-50"
                  }
                `}
              >
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-500
                    ${isActive
                      ? "bg-[#0C1A97] text-white"
                      : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 text-gray-400"
                    }
                  `}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-semibold transition-colors duration-500 ${
                    isActive
                      ? "text-[#0C1A97]"
                      : isDone
                      ? "text-emerald-700"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
                {isActive && (
                  <span className="ml-auto flex gap-0.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-[#0C1A97] animate-bounce"
                        style={{ animationDelay: `${d * 150}ms` }}
                      />
                    ))}
                  </span>
                )}
                {isDone && (
                  <span className="ml-auto text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    Done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Secured by DigiLocker · Govt. of India
        </p>
      </div>
    </div>
  );
}
