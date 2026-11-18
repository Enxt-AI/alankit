'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileUp, CheckCircle2 } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import { useMarketingCampaigns, useCreateLead } from '@/hooks/use-marketing-stats';
import type { CreateLeadDto } from '@/lib/marketing-api';

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Every mappable lead field. Labels mirror the Leads table columns and the
 * name-popup fields. Only `name` is mandatory; everything else is optional.
 * `target` decides where the value lands on the created lead.
 */
type MappingTarget = 'fullName' | 'email' | 'phone' | 'metadata';

interface MappingField {
  key: string;
  label: string;
  target: MappingTarget;
  /** metadata key when target === 'metadata' */
  metaKey?: string;
  parse?: 'int' | 'float' | 'names';
  required?: boolean;
  /** header auto-match patterns, tried in order */
  auto: RegExp[];
}

export const LEAD_MAPPING_FIELDS: MappingField[] = [
  { key: 'clientId', label: 'Client ID', target: 'metadata', metaKey: 'clientId', auto: [/client.?id/i, /^id$/i] },
  { key: 'name', label: 'Name', target: 'fullName', required: true, auto: [/full.?name/i, /^name$/i, /name/i] },
  { key: 'email', label: 'Email', target: 'email', auto: [/e-?mail/i] },
  { key: 'phone', label: 'Phone Number', target: 'phone', auto: [/phone/i, /mobile/i, /contact/i, /\btel\b/i] },
  { key: 'kycStatus', label: 'KYC Status', target: 'metadata', metaKey: 'kycStatus', auto: [/kyc/i] },
  { key: 'paymentStatus', label: 'Last Payment Status', target: 'metadata', metaKey: 'paymentStatus', auto: [/payment/i] },
  { key: 'totalTransactionCount', label: 'Total Transaction Count', target: 'metadata', metaKey: 'totalTransactionCount', parse: 'int', auto: [/total.*(count|txn|transaction)/i] },
  { key: 'transactionCount', label: 'Successful Transaction Count', target: 'metadata', metaKey: 'transactionCount', parse: 'int', auto: [/successful.*(count|txn)/i, /count|txns|transactions/i] },
  { key: 'totalTransactionValue', label: 'Total Transaction Value', target: 'metadata', metaKey: 'totalTransactionValue', parse: 'float', auto: [/total.*(value|amount|revenue)/i] },
  { key: 'transactionValue', label: 'Successful Transaction Value', target: 'metadata', metaKey: 'transactionValue', parse: 'float', auto: [/successful.*(value|amount)/i, /value|amount|revenue/i] },
  { key: 'lastShareName', label: 'Last Share', target: 'metadata', metaKey: 'lastShareName', auto: [/last.?share/i] },
  { key: 'sharesRequested', label: 'Successful Shares', target: 'metadata', metaKey: 'sharesRequested', parse: 'int', auto: [/successful.*share/i, /shares|qty|quantity/i] },
  { key: 'requestedShareNames', label: 'Shares Requested (Names)', target: 'metadata', metaKey: 'requestedShareNames', parse: 'names', auto: [/request|notif|interest/i] },
];

type ColumnMapping = Record<string, string>;

const emptyMapping = (): ColumnMapping =>
  Object.fromEntries(LEAD_MAPPING_FIELDS.map(f => [f.key, '']));

function autoMapHeaders(headers: string[]): ColumnMapping {
  const claimed = new Set<string>();
  const mapping = emptyMapping();
  for (const field of LEAD_MAPPING_FIELDS) {
    const hit = headers.find(h => !claimed.has(h) && field.auto.some(rx => rx.test(h)));
    if (hit) {
      mapping[field.key] = hit;
      claimed.add(hit);
    }
  }
  return mapping;
}

function parseCell(raw: any, parse?: 'int' | 'float' | 'names'): any {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (parse === 'int') {
    const n = parseInt(String(raw), 10);
    return Number.isNaN(n) ? undefined : n;
  }
  if (parse === 'float') {
    const n = parseFloat(String(raw));
    return Number.isNaN(n) ? undefined : n;
  }
  if (parse === 'names') {
    const names = String(raw).split(',').map(s => s.trim()).filter(Boolean);
    return names.length > 0 ? names : undefined;
  }
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

export default function ImportLeadsDialog({
  open,
  onOpenChange,
  onSuccess
}: ImportLeadsDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  // Mapping state
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping());

  const { data: campaigns } = useMarketingCampaigns();
  const createLeadMutation = useCreateLead();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      notify.error('Please upload a valid CSV file');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          notify.error('The CSV file is empty');
          return;
        }

        const headers = Object.keys(results.data[0] as any);
        setCsvHeaders(headers);
        setCsvData(results.data);
        setMapping(autoMapHeaders(headers));

        setStep(2);
      },
      error: (error) => {
        notify.error(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleImport = async () => {
    if (!selectedCampaignId) {
      notify.error('Please select a campaign');
      return;
    }
    // Only Name is mandatory for column mapping
    if (!mapping.name) {
      notify.error('Please map the Name column (mandatory)');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of csvData) {
      try {
        const metadata: Record<string, any> = { importedVia: 'csv_upload' };
        const payload: CreateLeadDto = {
          campaignId: selectedCampaignId,
          source: 'IMPORTED',
          status: 'NEW',
          metadata,
        };

        for (const field of LEAD_MAPPING_FIELDS) {
          const header = mapping[field.key];
          if (!header) continue;
          const value = parseCell(row[header], field.parse);
          if (value === undefined) continue;
          if (field.target === 'metadata') {
            metadata[field.metaKey as string] = value;
          } else {
            (payload as Record<string, any>)[field.target] = value;
          }
        }

        // Name is mandatory — skip rows without one
        if (!payload.fullName) {
          errorCount++;
          continue;
        }

        await createLeadMutation.mutateAsync(payload);
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }

    setIsSubmitting(false);
    setStep(3);
    notify.success(`Imported ${successCount} leads successfully`);
    if (errorCount > 0) {
      notify.error(`Failed to import ${errorCount} leads`);
    }
  };

  const handleReset = () => {
    setStep(1);
    setCsvData([]);
    setCsvHeaders([]);
    setSelectedCampaignId('');
    setMapping(emptyMapping());
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleReset();
      else onOpenChange(val);
    }}>
      <DialogContent className="rounded-xl border border-neutral-200/40 bg-white shadow-lg sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><Upload className="h-4 w-4" /></span>Import Leads <span className="ml-1 text-xs font-semibold text-[#64748B]">Step {step}/3</span></DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            {step === 1 && 'Upload a CSV file containing your leads.'}
            {step === 2 && 'Map the CSV columns to the lead fields. Only Name is mandatory.'}
            {step === 3 && 'Import complete.'}
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">

        {step === 1 && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200/60 bg-[#FAFBFC] py-8">
            <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
              <FileUp className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">Click to upload CSV</h3>
            <p className="text-xs text-neutral-500 mb-4 text-center max-w-[250px]">
              The CSV should contain headers. You can map them to the correct fields in the next step.
            </p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button onClick={() => fileInputRef.current?.click()} className="bg-[#16A34A] border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] font-semibold rounded-lg">
              <Upload className="h-4 w-4 mr-2" />
              Select File
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-neutral-900">Target Campaign *</label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign for these leads" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-neutral-900 border-b pb-2">Column Mapping</h4>

              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {LEAD_MAPPING_FIELDS.map(field => (
                  <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                    <span className="text-sm text-neutral-600">
                      {field.label}
                      {field.required && <span className="text-red-500 font-bold"> *</span>}
                    </span>
                    <Select
                      value={mapping[field.key] || 'none'}
                      onValueChange={(v) => setMapping({ ...mapping, [field.key]: v !== 'none' ? v : '' })}
                    >
                      <SelectTrigger><SelectValue placeholder={field.required ? 'Select column' : 'Skip (Optional)'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{field.required ? 'Select column' : 'Skip (Optional)'}</SelectItem>
                        {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>Back</Button>
              <Button onClick={handleImport} disabled={isSubmitting || !selectedCampaignId || !mapping.name} className="bg-[#16A34A] border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] font-semibold rounded-lg">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {csvData.length} Leads
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Import Successful</h3>
            <p className="text-sm text-neutral-500 max-w-[300px] mb-6">
              The leads have been successfully imported into your selected campaign.
            </p>
            <Button onClick={handleReset} className="h-10 px-8 rounded-lg font-semibold bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] w-full sm:w-auto">
              Done
            </Button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
