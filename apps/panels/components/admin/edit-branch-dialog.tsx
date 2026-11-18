'use client';

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Check, Loader2 } from 'lucide-react';
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
import type { BranchClassification, BranchClassificationPayload } from '@/hooks/use-network-management';
import {
  CLASSIFICATION_OPTIONS,
  CLASSIFICATION_FIELD_PATTERN,
  EMPTY_CLASSIFICATION_FIELDS,
  getClassificationOption,
  type ClassificationFieldKey,
} from '@/lib/branch-classification';

type BranchDetails = { name: string; email: string } & Record<ClassificationFieldKey, string>;
type FormErrors = Record<string, string | undefined>;

interface EditBranchDialogProps {
  branchId: string;
  onClose: () => void;
  onSave: (
    id: string,
    details: { name: string; email: string } & BranchClassificationPayload,
  ) => Promise<{ success: boolean; message?: string }>;
}

export function EditBranchDialog({ branchId, onClose, onSave }: EditBranchDialogProps) {
  const [details, setDetails] = useState<BranchDetails | null>(null);
  const [classification, setClassification] = useState<BranchClassification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const selectedOption = getClassificationOption(classification);

  useEffect(() => {
    let active = true;
    const loadDetails = async () => {
      try {
        // The list masks emails. Load the authorized edit details before saving.
        const response = await authApi.get(`/auth/admin/branches/${branchId}`);
        if (!response.data.success || !response.data.branch) {
          throw new Error('Unable to load branch details');
        }
        if (active) {
          const b = response.data.branch;
          const fields = { ...EMPTY_CLASSIFICATION_FIELDS };
          (Object.keys(fields) as ClassificationFieldKey[]).forEach((k) => {
            fields[k] = b[k] ?? '';
          });
          setDetails({ name: b.name, email: b.email, ...fields });
          setClassification(getClassificationOption(b.classification)?.value ?? null);
        }
      } catch (error) {
        if (active) {
          const message = isAxiosError(error) ? error.response?.data?.message : undefined;
          setErrors({ global: Array.isArray(message) ? message.join('. ') : message || 'Unable to load branch details. Please close and try again.' });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadDetails();
    return () => { active = false; };
  }, [branchId]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!details || isLoading || isSaving) return;

    const payload: { name: string; email: string } & BranchClassificationPayload = {
      name: details.name.trim(),
      email: details.email.trim().toLowerCase(),
    };
    const validationErrors: FormErrors = {};
    if (payload.name.length < 2 || payload.name.length > 100) {
      validationErrors.name = 'Branch name must be between 2 and 100 characters';
    } else if (!/^[a-zA-Z0-9\s\-'.&()]+$/.test(payload.name)) {
      validationErrors.name = 'Branch name contains invalid characters';
    }
    if (payload.email.length > 255 || !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(payload.email)) {
      validationErrors.email = 'Please enter a valid email address';
    }
    if (selectedOption) {
      payload.classification = selectedOption.value;
      selectedOption.fields.forEach((f) => {
        const value = details[f.key].trim();
        if (!value) validationErrors[f.key] = `${f.label} is required`;
        else if (!CLASSIFICATION_FIELD_PATTERN.test(value)) validationErrors[f.key] = `${f.label} contains invalid characters`;
        payload[f.key] = value;
      });
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    try {
      const result = await onSave(branchId, payload);
      if (result.success) {
        onClose();
      } else {
        setErrors({ global: result.message || 'Failed to update branch. Please try again.' });
      }
    } catch {
      setErrors({ global: 'Failed to update branch. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="rounded-[20px] bg-white sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0F172A]">Edit SMC Branch</DialogTitle>
          <DialogDescription>
            Update the classification, branch name and email. The branch will use the updated email to sign in.
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
                Loading branch details...
              </div>
            ) : details && (
              <fieldset disabled={isSaving} className="space-y-4">
                {/* Classification picker */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#0F172A]">Classification</Label>
                  {!selectedOption && (
                    <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      This branch has no classification yet. Select one to add its details.
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {CLASSIFICATION_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = classification === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          id={`branch-edit-classification-${opt.value.toLowerCase()}`}
                          onClick={() => { setClassification(opt.value); setErrors({}); }}
                          className={`relative flex flex-col items-center justify-center gap-1.5 rounded-[14px] border px-2 py-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                            active ? 'bg-white shadow-md' : 'bg-[#FAFBFC] border-neutral-200/70'
                          }`}
                          style={active ? { borderColor: opt.accent, boxShadow: `0 0 0 3px ${opt.accent}22` } : undefined}
                        >
                          {active && (
                            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ backgroundColor: opt.accent }}>
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${opt.accent}1A`, color: opt.accent }}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className={`text-[11px] font-bold uppercase tracking-wide ${active ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedOption && (
                  <div
                    key={selectedOption.value}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-[16px] border border-dashed p-4 animate-in fade-in slide-in-from-top-2 duration-300"
                    style={{ borderColor: `${selectedOption.accent}55`, backgroundColor: `${selectedOption.accent}08` }}
                  >
                    {selectedOption.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`branch-edit-${field.key}`} className="text-sm font-semibold text-[#0F172A]">{field.label}</Label>
                        <Input
                          id={`branch-edit-${field.key}`}
                          value={details[field.key]}
                          maxLength={100}
                          placeholder={field.placeholder}
                          onChange={(event) => {
                            setDetails({ ...details, [field.key]: event.target.value });
                            setErrors((previous) => ({ ...previous, [field.key]: undefined, global: undefined }));
                          }}
                          className={`h-10 rounded-[14px] bg-white ${errors[field.key] ? 'border-red-500' : 'border-neutral-200/60'}`}
                        />
                        {errors[field.key] && <p className="text-sm text-red-500">{errors[field.key]}</p>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="branch-edit-name" className="text-sm font-semibold text-[#0F172A]">Branch Name / Location</Label>
                  <Input
                    id="branch-edit-name"
                    value={details.name}
                    maxLength={100}
                    required
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'branch-edit-name-error' : undefined}
                    onChange={(event) => {
                      setDetails({ ...details, name: event.target.value });
                      setErrors((previous) => ({ ...previous, name: undefined, global: undefined }));
                    }}
                    className={`h-10 rounded-[14px] ${errors.name ? 'border-red-500' : 'border-neutral-200/60'}`}
                  />
                  {errors.name && <p id="branch-edit-name-error" className="text-sm text-red-500">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-edit-email" className="text-sm font-semibold text-[#0F172A]">Email Address</Label>
                  <Input
                    id="branch-edit-email"
                    type="email"
                    value={details.email}
                    maxLength={255}
                    required
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'branch-edit-email-error' : undefined}
                    onChange={(event) => {
                      setDetails({ ...details, email: event.target.value });
                      setErrors((previous) => ({ ...previous, email: undefined, global: undefined }));
                    }}
                    className={`h-10 rounded-[14px] ${errors.email ? 'border-red-500' : 'border-neutral-200/60'}`}
                  />
                  {errors.email && <p id="branch-edit-email-error" className="text-sm text-red-500">{errors.email}</p>}
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
