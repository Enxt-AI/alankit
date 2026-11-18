/**
 * esign-validation.util.ts
 *
 * Validates the identity returned by Digitap's e-Sign callback (webhook or
 * poll) against the KYC data we stored BEFORE the signing event.
 *
 * We intentionally do NOT trust the webhook payload by itself.  We look up
 * what we expect to see (name, Aadhaar suffix) from our own DB and compare.
 *
 * Verdicts:
 *   MATCH             — name AND/OR Aadhaar match adequately.
 *   MISMATCH          — at least one token we can verify failed to match.
 *   INSUFFICIENT_DATA — we lack the KYC data needed to make a determination
 *                       (e.g. user never completed Aadhaar KYC).
 *                       Route to manual review, not auto-approval.
 */

export type EsignVerdict = 'MATCH' | 'MISMATCH' | 'INSUFFICIENT_DATA';

export interface EsignValidationResult {
  verdict: EsignVerdict;
  reason: string;
  /** The name token returned by Digitap after signing */
  returnedName?: string;
  /** The name token we expected from KYC */
  expectedName?: string;
  /** The Aadhaar suffix (last 4 digits) returned by Digitap */
  returnedAadhaarSuffix?: string;
  /** The Aadhaar suffix we extracted from our masked Aadhaar KYC record */
  expectedAadhaarSuffix?: string;
}

/** Shape of one entry from Digitap's `signers` array */
export interface DigitapSignerEntry {
  /** Display name as entered during signing — may differ slightly from legal name */
  name?: string;
  /** `signerName` is sometimes used instead of/in addition to `name` by Digitap */
  signerName?: string;
  /** Last 4 digits of the Aadhaar used for OTP — the most reliable identifier */
  aadhaarSuffix?: string;
  /** Signing state, e.g. 'signed', 'pending' */
  state?: string;
  email?: string;
  mobile?: string;
  gender?: string;
  dob?: string;
}

/** The KYC data we have on file for this user */
export interface ExpectedSignerIdentity {
  /** `User.fullName` — legal name from registration/KYC */
  fullName: string | null;
  /**
   * Masked Aadhaar number stored in `kycData.digitapDetails.maskedAdharNumber`
   * Typical format: "XXXXXXXX1234"  (last 4 digits are the real digits).
   * We only look at the trailing 4 digits for comparison.
   */
  maskedAadhaarNumber: string | null;
  gender: string | null;
  dob: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise a name for comparison:
 *   - lower-case
 *   - remove punctuation
 *   - collapse multiple spaces
 *   - trim
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true when the first word of name A matches first word of name B.
 * Implements "50% match i.e. first word of name".
 */
function namesOverlapSufficiently(a: string, b: string): boolean {
  const tokensA = normaliseName(a).split(' ');
  const tokensB = normaliseName(b).split(' ');

  if (tokensA.length > 0 && tokensB.length > 0) {
    return tokensA[0] === tokensB[0];
  }
  return false;
}

/**
 * Extract the last 4 digits from a masked Aadhaar string like "XXXXXXXX1234"
 * or a raw 12-digit number.
 */
function extractAadhaarSuffix(masked: string): string | null {
  const digits = masked.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function normaliseGender(g: string): string {
  const lower = g.toLowerCase().trim();
  if (lower.startsWith('m')) return 'M';
  if (lower.startsWith('f')) return 'F';
  if (lower.startsWith('o')) return 'O';
  return lower;
}

function extractYear(dob: string): string | null {
  const match = dob.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? match[1] : null;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Compare the signer details returned by Digitap against our KYC records.
 *
 * Applies composite matching rules:
 * - Checks Aadhaar (if both present, must match)
 * - Checks Name (if both present, 50% first-word match)
 * - Checks Gender (if both present, must match)
 * - Checks DOB (if both present, year must match)
 *
 * Returns MISMATCH if ANY compared field fails.
 */
export function validateSignerIdentity(
  signer: DigitapSignerEntry,
  expected: ExpectedSignerIdentity,
): EsignValidationResult {
  // Resolve the returned name (Digitap uses either field)
  const returnedNameRaw = signer.signerName ?? signer.name ?? null;
  const mismatchReasons: string[] = [];

  // ── 1. Try Aadhaar suffix comparison ────────────────
  const returnedSuffix = signer.aadhaarSuffix
    ? signer.aadhaarSuffix.replace(/\D/g, '').slice(-4)
    : null;

  const expectedSuffix = expected.maskedAadhaarNumber
    ? extractAadhaarSuffix(expected.maskedAadhaarNumber)
    : null;

  if (returnedSuffix && expectedSuffix) {
    if (returnedSuffix !== expectedSuffix) {
      mismatchReasons.push(`Aadhaar suffix mismatch: returned ****${returnedSuffix}, expected ****${expectedSuffix}`);
    }
  }

  // ── 2. Name comparison ──────────────────────────────────────────
  if (returnedNameRaw && expected.fullName) {
    if (!namesOverlapSufficiently(returnedNameRaw, expected.fullName)) {
      mismatchReasons.push(`Name mismatch: returned "${returnedNameRaw}", expected "${expected.fullName}"`);
    }
  }

  // ── 3. Gender comparison ────────────────────────────────────────
  if (signer.gender && expected.gender) {
    if (normaliseGender(signer.gender) !== normaliseGender(expected.gender)) {
      mismatchReasons.push(`Gender mismatch: returned "${signer.gender}", expected "${expected.gender}"`);
    }
  }

  // ── 4. DOB comparison ───────────────────────────────────────────
  if (signer.dob && expected.dob) {
    const returnedYear = extractYear(signer.dob);
    const expectedYear = extractYear(expected.dob);
    if (returnedYear && expectedYear && returnedYear !== expectedYear) {
      mismatchReasons.push(`DOB Year mismatch: returned "${returnedYear}", expected "${expectedYear}"`);
    }
  }

  if (mismatchReasons.length > 0) {
    return {
      verdict: 'MISMATCH',
      reason: mismatchReasons.join(' | '),
      returnedName: returnedNameRaw ?? undefined,
      expectedName: expected.fullName ?? undefined,
      returnedAadhaarSuffix: returnedSuffix ?? undefined,
      expectedAadhaarSuffix: expectedSuffix ?? undefined,
    };
  }

  // Ensure at least Aadhaar OR Name was compared to consider it a MATCH
  if ((returnedSuffix && expectedSuffix) || (returnedNameRaw && expected.fullName)) {
    return {
      verdict: 'MATCH',
      reason: 'All verified identity fields (Aadhaar, Name, Gender, DOB) matched successfully.',
      returnedName: returnedNameRaw ?? undefined,
      expectedName: expected.fullName ?? undefined,
      returnedAadhaarSuffix: returnedSuffix ?? undefined,
      expectedAadhaarSuffix: expectedSuffix ?? undefined,
    };
  }

  return {
    verdict: 'INSUFFICIENT_DATA',
    reason: 'Neither Aadhaar suffix nor name were available for comparison. Route to manual review.',
    returnedName: returnedNameRaw ?? undefined,
    expectedName: expected.fullName ?? undefined,
    returnedAadhaarSuffix: returnedSuffix ?? undefined,
    expectedAadhaarSuffix: expectedSuffix ?? undefined,
  };
}
