# Phone-First Authentication Flow

## Overview
Users now authenticate via phone OTP first, then optionally link their Google account for email.

## Database Schema Changes
- `currentStep` values:
  - 0: New user
  - 1: Phone-only verified (no email)
  - 2: Phone + Email verified
  - 3: KYC completed
- `needsGoogle`: Computed field (`!user.email`)

## Migration
Run: `pnpm prisma migrate dev --name phone-unique-partial-signup`

## API Changes
- `GET /auth/profile` now includes `needsGoogle: boolean`
- `getUserById()` returns `needsGoogle` field

## Backward Compatibility
Existing users with `currentStep = 1` (Google-only) remain unchanged.
Data migration script adjusts users with both phone and email to `currentStep = 2`.