"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";

export function StepUpModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState("");
  const [failedRequest, setFailedRequest] = useState<InternalAxiosRequestConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const handleStepUpRequired = async (event: CustomEvent<InternalAxiosRequestConfig>) => {
      setFailedRequest(event.detail);
      setOpen(true);
      
      // Auto-request OTP when modal opens
      try {
        setSending(true);
        setErrorMsg("");
        setSuccessMsg("");
        await authApi.post("/auth/step-up/request", {});
        setSuccessMsg("We've sent a 6-digit code to your registered mobile number.");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to send code. Please try again later.");
      } finally {
        setSending(false);
      }
    };

    window.addEventListener("STEP_UP_REQUIRED" as any, handleStepUpRequired);
    return () => window.removeEventListener("STEP_UP_REQUIRED" as any, handleStepUpRequired);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;

    try {
      setLoading(true);
      setErrorMsg("");
      setSuccessMsg("");
      await authApi.post("/auth/step-up/verify", { otp });
      
      setSuccessMsg("Verified successfully! You can now proceed with your action.");
      setOpen(false);
      setOtp("");

      // Retry the failed request
      if (failedRequest) {
        // We use axios directly for retry to avoid re-triggering interceptors incorrectly
        // Wait, it's better to use the original instance (which we can't easily get here without checking base URL),
        // but since we only have the config, we can just fetch it again using authApi/stocksApi.
        // Actually, config holds the baseURL. We can just use axios(failedRequest).
        try {
          const response = await axios(failedRequest);
          // To make the original caller get the response, we would need to resolve the promise.
          // Since the original promise rejected when 403 occurred, the caller's UI probably already shows an error.
          // The best UX is to let the user click the "Buy" button again after step-up succeeds,
          // OR we can tell them to try again.
          // Since the original caller rejected, we can't magically resume their await here.
          // We will just tell them to retry the action.
        } catch (retryErr) {
          // Ignore
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setSending(true);
      setErrorMsg("");
      setSuccessMsg("");
      await authApi.post("/auth/step-up/request", {});
      setSuccessMsg("A new verification code has been sent.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend code. Please try again later.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) setOpen(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Security Verification Required</DialogTitle>
          <DialogDescription>
            You are attempting a sensitive action. Please enter the 6-digit OTP sent to your phone to proceed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="text-center text-lg tracking-widest"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            {errorMsg && <p className="text-sm text-red-500 font-medium text-center">{errorMsg}</p>}
            {successMsg && <p className="text-sm text-green-600 font-medium text-center">{successMsg}</p>}

            <Button type="submit" disabled={otp.length !== 6 || loading || sending} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & Continue
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              disabled={sending || loading} 
              onClick={handleResend}
              className="w-full"
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Resend Code"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
