'use client';

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DistributorDetails = { name: string; email: string };
type FormErrors = { name?: string; email?: string; global?: string };

interface EditDistributorDialogProps {
  distributorId: string;
  onClose: () => void;
  onSave: (id: string, details: DistributorDetails) => Promise<{ success: boolean; message?: string }>;
}

export function EditDistributorDialog({ distributorId, onClose, onSave }: EditDistributorDialogProps) {
  const [details, setDetails] = useState<DistributorDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    let active = true;
    const loadDetails = async () => {
      try {
        // The list masks emails. Load the authorized edit details before saving.
        const response = await authApi.get(`/auth/admin/distributors/${distributorId}`);
        if (!response.data.success || !response.data.distributor) {
          throw new Error('Unable to load distributor details');
        }
        if (active) {
          const { name, email } = response.data.distributor;
          setDetails({ name, email });
        }
      } catch (error) {
        if (active) {
          const message = isAxiosError(error) ? error.response?.data?.message : undefined;
          setErrors({ global: Array.isArray(message) ? message.join('. ') : message || 'Unable to load distributor details. Please close and try again.' });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadDetails();
    return () => { active = false; };
  }, [distributorId]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!details || isLoading || isSaving) return;

    const payload = { name: details.name.trim(), email: details.email.trim().toLowerCase() };
    const validationErrors: FormErrors = {};
    if (payload.name.length < 2 || payload.name.length > 100) {
      validationErrors.name = 'Distributor name must be between 2 and 100 characters';
    } else if (!/^[a-zA-Z0-9\s\-'.&()]+$/.test(payload.name)) {
      validationErrors.name = 'Distributor name contains invalid characters';
    }
    if (payload.email.length > 255 || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(payload.email)) {
      validationErrors.email = 'Please enter a valid email address';
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    try {
      const result = await onSave(distributorId, payload);
      if (result.success) {
        onClose();
      } else {
        setErrors({ global: result.message || 'Failed to update distributor. Please try again.' });
      }
    } catch {
      setErrors({ global: 'Failed to update distributor. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="rounded-[20px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0F172A]">Edit Distributor</DialogTitle>
          <DialogDescription>
            Update the distributor name and email. The distributor will use the updated email to sign in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} noValidate>
          <div className="space-y-4 py-4">
            {errors.global && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                {errors.global}
              </div>
            )}
            {isLoading ? (
              <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading distributor details...
              </div>
            ) : details && (
              <fieldset disabled={isSaving} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="distributor-edit-name" className="text-sm font-semibold text-[#0F172A]">Distributor Name</Label>
                  <Input
                    id="distributor-edit-name"
                    value={details.name}
                    maxLength={100}
                    required
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'distributor-edit-name-error' : undefined}
                    onChange={(event) => {
                      setDetails({ ...details, name: event.target.value });
                      setErrors((previous) => ({ ...previous, name: undefined, global: undefined }));
                    }}
                    className={`h-10 rounded-[14px] ${errors.name ? 'border-red-500' : 'border-neutral-200/60'}`}
                  />
                  {errors.name && <p id="distributor-edit-name-error" className="text-sm text-red-500">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distributor-edit-email" className="text-sm font-semibold text-[#0F172A]">Email Address</Label>
                  <Input
                    id="distributor-edit-email"
                    type="email"
                    value={details.email}
                    maxLength={255}
                    required
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'distributor-edit-email-error' : undefined}
                    onChange={(event) => {
                      setDetails({ ...details, email: event.target.value });
                      setErrors((previous) => ({ ...previous, email: undefined, global: undefined }));
                    }}
                    className={`h-10 rounded-[14px] ${errors.email ? 'border-red-500' : 'border-neutral-200/60'}`}
                  />
                  {errors.email && <p id="distributor-edit-email-error" className="text-sm text-red-500">{errors.email}</p>}
                </div>
              </fieldset>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={isSaving} onClick={onClose} className="rounded-lg h-10 px-4 font-semibold">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!details || isLoading || isSaving}
              className="rounded-lg h-10 px-4 font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
