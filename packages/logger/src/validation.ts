import { getRequestId } from './request-context.js';

/**
 * Minimal structural type for class-validator's ValidationError, so this
 * package does not need a dependency on class-validator.
 */
interface ValidationErrorLike {
  property: string;
  constraints?: Record<string, string>;
  children?: ValidationErrorLike[];
  target?: unknown;
  value?: unknown;
}

export interface ValidationIssue {
  field: string;
  constraints: string[];
  messages: string[];
}

/**
 * Flattens class-validator errors into a log-safe summary.
 * NEVER includes `target` (full request body) or `value` (user input),
 * which would leak passwords, OTPs, PAN, etc. into logs.
 */
export function summarizeValidationErrors(
  errors: ValidationErrorLike[],
  parentPath = '',
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const err of errors ?? []) {
    const field = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints && Object.keys(err.constraints).length > 0) {
      issues.push({
        field,
        constraints: Object.keys(err.constraints),
        messages: Object.values(err.constraints),
      });
    }
    if (err.children?.length) {
      issues.push(...summarizeValidationErrors(err.children, field));
    }
  }
  return issues;
}

/**
 * Builds the structured payload + human-readable message for a
 * `validation.failed` log line.
 */
export function buildValidationLog(errors: ValidationErrorLike[]): {
  payload: Record<string, unknown>;
  message: string;
} {
  const issues = summarizeValidationErrors(errors);
  const fields = issues.map((i) => i.field);
  const summary = issues
    .map((i) => `${i.field}: ${i.messages.join(', ')}`)
    .join('; ');
  return {
    payload: {
      event: 'validation.failed',
      requestId: getRequestId(),
      fields,
      issues,
    },
    message: summary ? `Validation failed - ${summary}` : 'Validation failed',
  };
}

