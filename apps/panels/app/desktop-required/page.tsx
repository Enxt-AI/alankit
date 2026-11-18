import { Laptop } from "lucide-react";

export default function DesktopRequired() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-[24px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto">
          <Laptop className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Desktop Only System</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            SMC Internal Systems are strictly restricted and optimized for desktop computer screens only. Mobile and tablet access is disabled for security and operational layout constraints.
          </p>
        </div>
        <div className="text-xs text-slate-400 border-t border-slate-50 pt-4">
          Please access this system from a desktop computer.
        </div>
      </div>
    </div>
  );
}
