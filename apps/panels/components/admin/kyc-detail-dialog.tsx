'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserDetailsWithKyc } from '@/hooks/use-user-by-id';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, User, CreditCard, Clock, ExternalLink, Landmark, ShieldCheck, Trash2, Contact, Link } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import { approveUserDemat, rejectUserDemat, permanentlyDeleteUser } from '@/lib/admin-api';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface KycDetailDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dematOnly?: boolean;
}

/**
 * Dialog component to display detailed KYC information
 * Includes personal info, verification progress, documents, and approval/rejection actions
 */
export function KycDetailDialog({ userId, open, onOpenChange, dematOnly = false }: KycDetailDialogProps) {
  const queryClient = useQueryClient();
  const { data: user, isLoading, refetch } = useUserDetailsWithKyc(userId || '');
  
  const [activeTab, setActiveTab] = useState<string>(dematOnly ? 'demat' : 'personal');

  useEffect(() => {
    if (open) {
      setActiveTab(dematOnly ? 'demat' : 'personal');
    }
  }, [open, dematOnly]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejectingDemat, setIsRejectingDemat] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteUser = async () => {
    if (!userId) return;
    if (!window.confirm('Are you absolutely sure you want to permanently delete this user? This will erase all DB records and uploaded files and CANNOT BE UNDONE.')) {
      return;
    }
    
    try {
      setIsDeleting(true);
      const result = await permanentlyDeleteUser(userId);
      if (result.redisCleanupPending) {
        notify.error(result.message);
      } else {
        notify.success(result.message);
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onOpenChange(false);
    } catch (error: any) {
      notify.error(error.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApproveDemat = async () => {
    if (!userId) return;
    try {
      setIsSubmitting(true);
      await approveUserDemat(userId);
      notify.success('Demat Account Approved successfully');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      // Depending on UI flow, you might want to auto-close: onOpenChange(false);
    } catch (error: any) {
      notify.error(error.message || 'Failed to approve Demat Account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectDemat = async () => {
    if (!userId || !rejectReason.trim()) return;
    try {
      setIsSubmitting(true);
      await rejectUserDemat(userId, rejectReason.trim());
      notify.success('Demat Account Rejected successfully');
      setIsRejectingDemat(false);
      setRejectReason('');
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (error: any) {
      notify.error(error.message || 'Failed to reject Demat Account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 rounded-full px-3 py-1 font-medium">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Pending Review
          </Badge>
        );
      case 'VERIFIED':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 rounded-full px-3 py-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Verified
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 rounded-full px-3 py-1 font-medium">
            <XCircle className="w-3.5 h-3.5 mr-1.5" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline" className="rounded-full px-3 py-1 font-medium">{status}</Badge>;
    }
  };

  const maskPan = (pan: string) => {
    if (!pan || pan.length < 10) return pan;
    return `${pan.substring(0, 4)}XXXXXX${pan.substring(pan.length - 1)}`;
  };

  const formatAddress = (address: any) => {
    if (!address) return '-';
    if (typeof address === 'string') return address;
    const parts = [address.house, address.street, address.loc, address.landmark, address.vtc, address.dist, address.state].filter(Boolean);
    return `${parts.join(', ')}${address.pc ? ` - ${address.pc}` : ''}`;
  };


  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center pr-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  {dematOnly ? <Link className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {dematOnly ? 'Demat Details' : 'KYC Details'}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {dematOnly
                      ? 'Review user Demat linking information and proof document'
                      : 'Review user information and verification documents'}
                  </DialogDescription>
                </div>
              </div>
              {!dematOnly && (
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-semibold rounded-lg px-4"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Permanently Delete User'}
                </Button>
              )}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !user ? (
            <div className="text-center py-12 mt-6">
              <p className="text-muted-foreground">User not found</p>
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-6 border border-slate-200 rounded-2xl bg-white shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <User className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-slate-900">{user.fullName || 'No name'}</p>
                    <p className="text-base text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex justify-end mb-2">
                    {getKycStatusBadge(dematOnly ? (user.dematStatus || 'PENDING') : user.kycStatus)}
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Updated {format(new Date(user.updatedAt), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              {/* Tabbed Content */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className={cn(
                  "flex w-full bg-transparent border-b border-slate-200 h-auto p-0 mb-6",
                  dematOnly ? "justify-start" : "justify-between"
                )}>
                  {!dematOnly && (
                    <>
                      <TabsTrigger 
                        value="personal" 
                        className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent py-3 font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        <User className="w-4 h-4 mr-2" />
                        Personal Info
                      </TabsTrigger>
                      <TabsTrigger 
                        value="progress"
                        className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent py-3 font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        <Contact className="w-4 h-4 mr-2" />
                        KYC Details
                      </TabsTrigger>
                      <TabsTrigger 
                        value="timeline"
                        className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent py-3 font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Timeline
                      </TabsTrigger>
                    </>
                  )}
                  <TabsTrigger 
                    value="demat"
                    className={cn(
                      "rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent py-3 font-semibold text-slate-500 hover:text-slate-900 transition-colors",
                      dematOnly ? "px-6" : "flex-1"
                    )}
                  >
                    <Link className="w-4 h-4 mr-2" />
                    Demat Link
                  </TabsTrigger>
                  {!dematOnly && (
                    <TabsTrigger 
                      value="bank"
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent py-3 font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      <Landmark className="w-4 h-4 mr-2" />
                      Bank Details
                    </TabsTrigger>
                  )}
                </TabsList>

                {!dematOnly && (
                  <>
                {/* Personal Info Tab */}
                <TabsContent value="personal" className="mt-0">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-12 border border-slate-200 rounded-2xl p-6 bg-white shadow-sm">
                    <div className="space-y-2 border-b border-slate-100 pb-5">
                      <label className="text-sm font-medium text-slate-500">Full Name</label>
                      <p className="text-base font-medium text-slate-900">{user.fullName || '-'}</p>
                    </div>
                    <div className="space-y-2 border-b border-slate-100 pb-5">
                      <label className="text-sm font-medium text-slate-500">Email</label>
                      <p className="text-base font-medium text-slate-900">{user.email || '-'}</p>
                    </div>
                    <div className="space-y-2 border-b border-slate-100 pb-5">
                      <label className="text-sm font-medium text-slate-500">Phone</label>
                      <p className="text-base font-medium text-slate-900">{user.phone || '-'}</p>
                    </div>
                    <div className="space-y-2 pb-5">
                      <label className="text-sm font-medium text-slate-500">Registered</label>
                      <p className="text-base font-medium text-slate-900">{format(new Date(user.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                    </div>
                    <div className="space-y-2 pb-2">
                      <label className="text-sm font-medium text-slate-500">Last Updated</label>
                      <p className="text-base font-medium text-slate-900">{format(new Date(user.updatedAt), 'MMM dd, yyyy HH:mm')}</p>
                    </div>
                  </div>
                </TabsContent>

                {/* KYC Progress Tab */}
                <TabsContent value="progress" className="space-y-4">
                  {user.kycData && typeof user.kycData === 'object' ? (
                    <div className="space-y-6">
                      {/* PAN Details */}
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium">PAN Card Details</h4>
                          </div>
                          {(user.kycData as any).panDetails?.verified ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        {(user.kycData as any).panDetails ? (
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">PAN: </span>
                              <span className="font-mono">{maskPan((user.kycData as any).panDetails.pan || '')}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Name: </span>
                              <span>{(user.kycData as any).panDetails.name || '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">DOB: </span>
                              <span>{(user.kycData as any).panDetails.dob || '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Verified: </span>
                              <span>{(user.kycData as any).panDetails.verified ? 'Yes' : 'No'}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not submitted</p>
                        )}
                      </div>

                      {/* Aadhaar Details */}
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium">Aadhaar Card Details</h4>
                          </div>
                          {(user.kycData as any).aadhaarDetails?.verified ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        {(user.kycData as any).aadhaarDetails ? (
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Aadhaar: </span>
                              <span className="font-mono">
                                {(user.kycData as any).aadhaarDetails.aadhaar
                                  ? `XXXX-XXXX-${String((user.kycData as any).aadhaarDetails.aadhaar).slice(-4)}`
                                  : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Name: </span>
                              <span>{(user.kycData as any).aadhaarDetails.name || '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">DOB: </span>
                              <span>{(user.kycData as any).aadhaarDetails.dob || '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Gender: </span>
                              <span>{(user.kycData as any).aadhaarDetails.gender || '-'}</span>
                            </div>
                            <div className="col-span-2">
                              <span>{(user.kycData as any).aadhaarDetails.fatherName || '-'}</span>
                            </div>
                            {/* Wait, the address might be an object or string depending on the digilocker mapper. Either way, toString handles primitives. Or we can just omit address and keep it simple. Let's include address safely. */}
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Address: </span>
                              <span>
                                {formatAddress((user.kycData as any).aadhaarDetails.address)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Verified: </span>
                              <span>{(user.kycData as any).aadhaarDetails.verified ? 'Yes' : 'No'}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not submitted</p>
                        )}
                      </div>


                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No KYC data available</p>
                  )}
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="space-y-4">
                  <div className="space-y-4">
                    {(user.kycData as any)?.submittedAt && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm font-medium">KYC Submitted</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date((user.kycData as any).submittedAt), 'MMM dd, yyyy HH:mm')}
                          </p>

                        </div>
                      </div>
                    )}

                    {(user.kycData as any)?.approvedAt && (
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium">KYC Approved</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date((user.kycData as any).approvedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                          {(user.kycData as any)?.approvedBy && (
                            <p className="text-xs text-muted-foreground">By: {(user.kycData as any).approvedBy}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {(user.kycData as any)?.rejectedAt && (
                      <div className="flex items-start gap-3">
                        <XCircle className="h-4 w-4 text-red-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium">KYC Rejected</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date((user.kycData as any).rejectedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                          {(user.kycData as any)?.rejectionReason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Reason: {(user.kycData as any).rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Demat Link Events */}
                    {(user.dematData as any)?.submittedAt && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm font-medium">Demat Linking Submitted</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date((user.dematData as any).submittedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    )}

                    {user.dematStatus === 'VERIFIED' && (user.dematData as any)?.lastUpdatedAt && (
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium">Demat Linking Verified</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date((user.dematData as any).lastUpdatedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    )}

                    {user.dematStatus === 'REJECTED' && (user.dematData as any)?.lastUpdatedAt && (
                      <div className="flex items-start gap-3">
                        <XCircle className="h-4 w-4 text-red-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium">Demat Linking Rejected</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date((user.dematData as any).lastUpdatedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                          {(user.dematData as any)?.rejectionReason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Reason: {(user.dematData as any).rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {!(user.kycData as any)?.submittedAt && !(user.kycData as any)?.approvedAt && !(user.kycData as any)?.rejectedAt && !(user.dematData as any)?.submittedAt && !(user.dematData as any)?.lastUpdatedAt && (
                      <p className="text-center text-muted-foreground py-8">No timeline events</p>
                    )}
                  </div>
                </TabsContent>
                  </>
                )}

                {/* Demat Link Tab */}
                <TabsContent value="demat" className="space-y-4">
                  {user.dematData && typeof user.dematData === 'object' ? (
                    <div className="space-y-6">
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Demat Linking Request</h4>
                          {getKycStatusBadge(user.dematStatus)}
                        </div>
                        {(() => {
                          const dd = user.dematData as any;
                          let rawAcc = (dd?.accountNumber || dd?.dematAccountNo || dd?.boId || '').toString().trim().toUpperCase();
                          let rawDpId = (dd?.dpId || '').toString().trim().toUpperCase();
                          let rawClientId = (dd?.clientId || '').toString().trim().toUpperCase();
                          let fullBoId = rawAcc;
                          if (!fullBoId && rawDpId && rawClientId) {
                            fullBoId = `${rawDpId}${rawClientId}`;
                          }
                          if (fullBoId && fullBoId.length === 16) {
                            rawDpId = fullBoId.slice(0, 8);
                            rawClientId = fullBoId.slice(8);
                          } else if (rawDpId.startsWith('IN') && (rawDpId.length + rawClientId.length === 16)) {
                            const combined = `${rawDpId}${rawClientId}`;
                            rawDpId = combined.slice(0, 8);
                            rawClientId = combined.slice(8);
                            fullBoId = combined;
                          }
                          return (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">BO ID: </span>
                                <span className="font-mono">{fullBoId || '-'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">DP ID: </span>
                                <span className="font-mono">{rawDpId || '-'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Client ID: </span>
                                <span className="font-mono">{rawClientId || '-'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Submitted At: </span>
                                <span>
                                  {dd?.submittedAt 
                                    ? format(new Date(dd.submittedAt), 'MMM dd, yyyy HH:mm')
                                    : '-'}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {user.dematDocuments && (user.dematDocuments as any).dematStatement && (
                        <div className="border rounded-lg p-4 border-blue-200 bg-blue-50/30">
                           <h4 className="font-medium text-blue-900 mb-2">Demat Statement Document</h4>
                           <a
                              href={((user.dematDocuments as any).dematStatement.fileUrl || '')
                                // Route through /storage proxy to strip cookies and prevent MetadataTooLarge
                                .replace(/http:\/\/[a-zA-Z0-9.-]+:\d+/g, '/storage')
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline flex items-center gap-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Statement in new tab
                            </a>
                        </div>
                      )}

                      {/* Action Buttons for Demat */}
                      {user.dematStatus === 'PENDING' && (
                         <div className="flex flex-col gap-4 pt-4 border-t mt-6">
                            {isRejectingDemat ? (
                              <div className="space-y-3 p-4 border border-red-200 bg-red-50 rounded-lg">
                                <label className="text-sm font-medium text-red-900">Reason for Demat Rejection</label>
                                <input 
                                  type="text" 
                                  className="w-full px-3 py-2 border rounded-md text-sm"
                                  placeholder="e.g. Document image is blurry"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <div className="flex justify-end gap-2">
                                   <Button variant="ghost" size="sm" onClick={() => setIsRejectingDemat(false)} disabled={isSubmitting}>Cancel</Button>
                                   <Button variant="destructive" size="sm" onClick={handleRejectDemat} disabled={isSubmitting || !rejectReason.trim()}>
                                     {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                                   </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-3">
                                 <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setIsRejectingDemat(true)}>
                                   Reject Demat
                                 </Button>
                                 <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleApproveDemat} disabled={isSubmitting}>
                                   {isSubmitting ? 'Approving...' : 'Approve Demat'}
                                 </Button>
                              </div>
                            )}
                         </div>
                      )}

                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No Demat linking requests submitted</p>
                  )}
                </TabsContent>

                {!dematOnly && (
                  /* Bank Details Tab */
                  <TabsContent value="bank" className="space-y-4">
                    {user.bankData && typeof user.bankData === 'object' ? (() => {
                      const bd = user.bankData as any;
                      const beneficiary = bd.beneficiaryName || bd.benificiaryName || bd.accountHolder || '-';
                      const accNo = bd.accountNumber || bd.accNo || '-';
                      const bankIfsc = bd.ifsc || '-';
                      const bankNameVal = bd.bankName || '-';
                      const branchNameVal = bd.branchName || '-';
                      const cityVal = bd.city || '';
                      const stateVal = bd.state || '';
                      const micrVal = bd.micr || '';
                      const bankVerified = user.bankStatus === 'VERIFIED';
                      return (
                        <div className="space-y-4">
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Landmark className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-medium">Bank Account</h4>
                              </div>
                              {getKycStatusBadge(user.bankStatus)}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">Beneficiary Name</span>
                                <p className="font-medium">{beneficiary}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">Bank Name</span>
                                <p className="font-medium">{bankNameVal}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">Branch Name</span>
                                <p className="font-medium">{branchNameVal}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">Account Number</span>
                                <p className="font-medium font-mono">{accNo}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs">IFSC Code</span>
                                <p className="font-medium font-mono">{bankIfsc}</p>
                              </div>
                              {(cityVal || stateVal) && (
                                <div className="space-y-1">
                                  <span className="text-muted-foreground text-xs">Location</span>
                                  <p className="font-medium">{[cityVal, stateVal].filter(Boolean).join(', ')}</p>
                                </div>
                              )}
                              {micrVal && (
                                <div className="space-y-1">
                                  <span className="text-muted-foreground text-xs">MICR Code</span>
                                  <p className="font-medium font-mono">{micrVal}</p>
                                </div>
                              )}
                              {bd.matchScore !== undefined && (
                                <div className="space-y-1">
                                  <span className="text-muted-foreground text-xs">Name Match Score</span>
                                  <p className={`font-bold ${bd.matchScore >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                                    {bd.matchScore}%
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Verification Status */}
                          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                            bankVerified
                              ? 'bg-green-50 border border-green-200 text-green-800'
                              : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                          }`}>
                            {bankVerified ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className="font-medium">
                              {bankVerified ? 'Bank Account Verified' : 'Verification Pending'}
                            </span>
                            {bd.submittedAt && (
                              <span className="text-xs ml-auto">
                                {format(new Date(bd.submittedAt), 'MMM dd, yyyy HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <p className="text-center text-muted-foreground py-8">No bank details submitted</p>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>




    </>
  );
}
