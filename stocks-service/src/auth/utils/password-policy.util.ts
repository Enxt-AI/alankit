import { BadRequestException } from '@nestjs/common';

export const MIN_PASSWORD_LENGTH = 8;

export const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'password123!',
  'admin123456',
  'admin@123456',
  'qwerty123456',
  'qwerty@123456',
  'welcome12345',
  'welcome@12345',
  'welcome123!@#',
  '123456789012',
  'smcunlisted123',
  'smcadmin1234',
  'letmein123456',
]);

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]).{8,}$/;

/**
 * Validates password strength on the backend before hashing.
 * Throws BadRequestException if password does not meet enterprise security standards.
 */
export function assertStrongPassword(password: string): void {
  if (!password || typeof password !== 'string') {
    throw new BadRequestException('Password is required.');
  }

  const p = password.trim();

  if (p.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }

  if (COMMON_WEAK_PASSWORDS.has(p.toLowerCase())) {
    throw new BadRequestException(
      'This password is too common and easily guessable. Please choose a more unique password.',
    );
  }

  if (!STRONG_PASSWORD_REGEX.test(p)) {
    throw new BadRequestException(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    );
  }
}
