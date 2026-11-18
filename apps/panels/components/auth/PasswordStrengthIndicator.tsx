'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { validatePassword, PasswordValidationResult } from '@/lib/password-policy';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
}: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const result: PasswordValidationResult = validatePassword(password);

  const getBarColor = (score: number) => {
    switch (score) {
      case 1:
        return 'bg-red-500';
      case 2:
        return 'bg-amber-500';
      case 3:
        return 'bg-emerald-500';
      case 4:
        return 'bg-emerald-600';
      default:
        return 'bg-slate-200';
    }
  };

  const getTextColor = (label: string) => {
    switch (label) {
      case 'Weak':
        return 'text-red-500';
      case 'Fair':
        return 'text-amber-600';
      case 'Good':
      case 'Strong':
        return 'text-emerald-600';
      default:
        return 'text-slate-500';
    }
  };

  return (
    <div className="space-y-2.5 pt-1">
      {/* Strength meter bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-medium">Password Strength:</span>
          <span className={`font-bold ${getTextColor(result.strengthLabel)}`}>
            {result.strengthLabel}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`h-full rounded-full transition-all duration-300 ${
                result.score >= level ? getBarColor(result.score) : 'bg-slate-100'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Checklist */}
      {showRequirements && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px]">
          {result.requirements.map((req) => (
            <div
              key={req.id}
              className={`flex items-center gap-1.5 transition-colors ${
                req.met ? 'text-emerald-700 font-semibold' : 'text-slate-500'
              }`}
            >
              {req.met ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              )}
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
