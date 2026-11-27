/**
 * Password Policy Enforcement Utility (Security Best Practice)
 *
 * Requirements (NIST / OWASP / CERT-In compliant):
 * 1. Minimum 8 characters length
 * 2. At least one uppercase letter (A-Z)
 * 3. At least one lowercase letter (a-z)
 * 4. At least one number (0-9)
 * 5. At least one special character (!@#$%^&*...)
 * 6. Disallow common / easily guessable breached passwords
 */

export const MIN_PASSWORD_LENGTH = 8;

export const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password123",
  "password123!",
  "admin123456",
  "admin@123456",
  "qwerty123456",
  "qwerty@123456",
  "welcome12345",
  "welcome@12345",
  "welcome123!@#",
  "123456789012",
  "unlisted123",
  "admin1234",
  "letmein123456",
]);

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 4
  strengthLabel: "Weak" | "Fair" | "Good" | "Strong";
  requirements: PasswordRequirement[];
  errorMessage?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  const p = password || "";

  const requirements: PasswordRequirement[] = [
    {
      id: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: p.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: "uppercase",
      label: "At least one uppercase letter (A-Z)",
      met: /[A-Z]/.test(p),
    },
    {
      id: "lowercase",
      label: "At least one lowercase letter (a-z)",
      met: /[a-z]/.test(p),
    },
    {
      id: "number",
      label: "At least one number (0-9)",
      met: /[0-9]/.test(p),
    },
    {
      id: "special",
      label: "At least one special character (!@#$%^&*...)",
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]/.test(p),
    },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const isCommon = COMMON_WEAK_PASSWORDS.has(p.toLowerCase().trim());

  let score = 0;
  if (metCount >= 2) score = 1;
  if (metCount >= 4) score = 2;
  if (metCount === 5) score = 3;
  if (metCount === 5 && p.length >= 14) score = 4;

  if (isCommon) {
    score = 0;
  }

  let strengthLabel: "Weak" | "Fair" | "Good" | "Strong" = "Weak";
  if (score === 2) strengthLabel = "Fair";
  else if (score === 3) strengthLabel = "Good";
  else if (score === 4) strengthLabel = "Strong";

  let errorMessage: string | undefined;
  if (isCommon) {
    errorMessage =
      "This password is too common and easily guessable. Please choose a more unique password.";
  } else if (p.length < MIN_PASSWORD_LENGTH) {
    errorMessage = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  } else if (metCount < requirements.length) {
    const unmet = requirements.filter((r) => !r.met).map((r) => r.label);
    errorMessage = `Password must meet all requirements: ${unmet.join(", ")}.`;
  }

  return {
    isValid: metCount === requirements.length && !isCommon,
    score,
    strengthLabel,
    requirements,
    errorMessage,
  };
}

/**
 * Generates a cryptographically strong, random temporary password
 * complying with uppercase, lowercase, numbers, and special symbols.
 */
export function generateRandomPassword(length = 8): string {
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";

  const chars = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  const pool = lowercase + uppercase + numbers + symbols;
  while (chars.length < length) {
    chars.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
