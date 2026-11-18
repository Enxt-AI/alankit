'use client';

import { useState, useEffect, useCallback } from 'react';
import { Monitor, Smartphone, Globe, Clock, LogOut, Shield, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  fetchActiveSessions,
  terminateSession,
  terminateAllOtherSessions,
  type ActiveSession,
} from '@/lib/auth-api';

interface ActiveSessionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseUserAgent(ua: string, deviceClass?: string): { device: string; browser: string; icon: 'desktop' | 'mobile' } {
  const isApkClass = deviceClass === 'APK';
  if (!ua || ua === 'Unknown') {
    if (isApkClass) return { device: 'Android', browser: 'Mobile App', icon: 'mobile' };
    return { device: 'Unknown Device', browser: 'Web Browser', icon: 'desktop' };
  }

  let browser = 'Unknown Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  const isMobile =
    isApkClass ||
    ua.includes('Mobile') ||
    ua.includes('Android') ||
    ua.includes('iPhone') ||
    ua.includes('okhttp') ||
    ua.includes('Expo') ||
    ua.includes('APK');

  if (
    isApkClass ||
    ua.includes('Mobile App') ||
    ua.includes('okhttp') ||
    ua.includes('Expo') ||
    (isMobile && browser === 'Unknown Browser')
  ) {
    browser = 'Mobile App';
    if (os === 'Unknown OS') os = 'Android';
  }

  return {
    device: os,
    browser,
    icon: isMobile ? 'mobile' : 'desktop',
  };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActiveSessionsDialog({ open, onOpenChange }: ActiveSessionsDialogProps) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [terminatingAll, setTerminatingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchActiveSessions();
      setSessions(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open, loadSessions]);

  const handleTerminate = async (sessionId: string) => {
    setTerminatingId(sessionId);
    setErrorMsg(null);
    try {
      await terminateSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to terminate session');
    } finally {
      setTerminatingId(null);
    }
  };

  const handleTerminateAll = async () => {
    setTerminatingAll(true);
    setErrorMsg(null);
    try {
      await terminateAllOtherSessions();
      await loadSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to terminate sessions');
    } finally {
      setTerminatingAll(false);
    }
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 rounded-xl border border-neutral-200/60 shadow-xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 pr-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF5] border border-[#16A34A]/10">
                <Shield className="h-4.5 w-4.5 text-[#16A34A]" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-[#0F172A]">Active Sessions</DialogTitle>
                <p className="text-[10px] text-[#64748B] font-medium mt-0.5">Manage your logged-in devices</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] font-semibold text-[#0F172A] border-slate-200 hover:bg-slate-50 rounded-md"
              onClick={loadSessions}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="px-5 pb-5">
          {errorMsg && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100 flex items-start gap-2">
              <span className="font-semibold text-red-700">Error:</span> {errorMsg}
            </div>
          )}

          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[#16A34A]" />
              <span className="ml-2 text-xs text-[#64748B]">Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Shield className="h-8 w-8 text-[#CBD5E1] mb-2" />
              <p className="text-xs text-[#64748B] font-medium">No active sessions found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSessions}
                disabled={loading}
                className="mt-3 text-xs font-semibold px-4 h-8 text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs"
              >
                {loading ? 'Checking...' : 'Check Again'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((session) => {
                const { device, browser, icon } = parseUserAgent(session.device, (session as any).deviceClass);
                const DeviceIcon = icon === 'mobile' ? Smartphone : Monitor;

                return (
                  <div
                    key={session.id}
                    className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                      session.isCurrent
                        ? 'bg-[#ECFDF5]/50 border-[#16A34A]/20'
                        : 'bg-white border-neutral-200/60 hover:border-neutral-300/60 hover:shadow-sm'
                    }`}
                  >
                    {/* Device Icon */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      session.isCurrent
                        ? 'bg-[#16A34A]/10 text-[#16A34A]'
                        : 'bg-neutral-100 text-[#64748B]'
                    }`}>
                      <DeviceIcon className="h-4 w-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#0F172A] truncate">{browser} on {device}</span>
                        {session.isCurrent && (
                          <Badge className="bg-[#16A34A] hover:bg-[#16A34A] text-white text-[8px] font-bold px-1.5 py-0 h-4 rounded">
                            THIS DEVICE
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                          <Globe className="h-2.5 w-2.5" />
                          {session.ip}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(session.lastActive)}
                        </span>
                      </div>
                    </div>

                    {/* Terminate Button */}
                    {!session.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md text-[10px] font-semibold shrink-0"
                        onClick={() => handleTerminate(session.id)}
                        disabled={terminatingId === session.id}
                      >
                        {terminatingId === session.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <LogOut className="h-3 w-3 mr-1" />
                            End
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Terminate All Others Button */}
          {otherSessions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-200/60">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 rounded-lg transition-all duration-200"
                onClick={handleTerminateAll}
                disabled={terminatingAll}
              >
                {terminatingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                )}
                Log out all other devices ({otherSessions.length})
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
