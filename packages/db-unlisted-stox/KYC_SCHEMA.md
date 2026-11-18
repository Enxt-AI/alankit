# KYC Data Structure

This document describes the structure of KYC (Know Your Customer) data stored in the User model.

## Overview

The KYC verification process is tracked using three main fields in the User model:

1. **`currentStep`** (Integer) - Overall user journey tracking
2. **`kycData`** (JSON) - Detailed KYC progress and form data
3. **`kycDocuments`** (JSON) - Document upload references

## User.currentStep (Integer)

Tracks the overall user journey:

- `0` = New user (just created account)
- `1` = Email/Google authenticated
- `2` = Phone verified
- `3` = KYC in progress (check `kycData.currentKycStep` for sub-step)
- `4` = KYC completed (future: post-KYC steps)

**Usage:**
```typescript
// Start KYC process
await prisma.user.update({
  where: { id: userId },
  data: { currentStep: 3 }
});

// Check if user is in KYC flow
const user = await prisma.user.findUnique({ where: { id: userId } });
if (user.currentStep === 3) {
  // User is in KYC process
  const kycStep = user.kycData?.currentKycStep || 1;
}
```

## User.kycData (JSON)

Tracks user's KYC verification progress across multiple steps.

### Structure

```typescript
interface KycData {
  currentKycStep: 1 | 2 | 3 | 4 | 5;
  panDetails?: {
    pan: string;
    name: string;
    dob: string;
    verified: boolean;
  };
  aadhaarDetails?: {
    aadhaar: string;
    verified: boolean;
    otpSent: boolean;
  };
  bankDetails?: {
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
    verified: boolean;
  };
  documentsUploaded?: {
    pan: boolean;
    aadhaar: boolean;
    bank: boolean;
  };
  lastUpdatedStep?: string; // ISO timestamp
  submittedAt?: string; // ISO timestamp
}
```

### KYC Steps

1. **PAN Verification** (`currentKycStep: 1`)
   - User enters PAN number
   - System validates PAN format
   - Mock mode: Auto-verify or require manual approval
   - Production: API call to Digio/Signzy for verification

2. **Aadhaar Verification** (`currentKycStep: 2`)
   - User enters Aadhaar number
   - OTP sent to Aadhaar-linked mobile
   - User enters OTP to verify
   - Mock mode: Simulate OTP flow
   - Production: UIDAI API integration

3. **Bank Account Verification** (`currentKycStep: 3`)
   - User enters bank account details (Account number, IFSC, Account holder name)
   - Penny drop verification (send ₹1, user confirms transaction)
   - Mock mode: Skip penny drop, auto-verify
   - Production: NPCI API for penny drop

4. **Document Upload** (`currentKycStep: 4`)
   - User uploads documents (PAN card, Aadhaar front/back, bank proof)
   - Documents stored in S3 or local storage
   - References stored in `kycDocuments` field

5. **Review & Submit** (`currentKycStep: 5`)
   - User reviews all entered information
   - Final submission for admin approval
   - `submittedAt` timestamp recorded
   - Admin reviews and approves/rejects

### Example Usage

```typescript
// Initialize KYC process
await prisma.user.update({
  where: { id: userId },
  data: {
    currentStep: 3,
    kycData: {
      currentKycStep: 1,
      lastUpdatedStep: new Date().toISOString(),
    },
  },
});

// Update PAN details
await prisma.user.update({
  where: { id: userId },
  data: {
    kycData: {
      currentKycStep: 1,
      panDetails: {
        pan: 'ABCDE1234F',
        name: 'John Doe',
        dob: '1990-01-01',
        verified: false,
      },
      lastUpdatedStep: new Date().toISOString(),
    },
  },
});

// Move to next step
await prisma.user.update({
  where: { id: userId },
  data: {
    kycData: {
      ...user.kycData,
      currentKycStep: 2,
      lastUpdatedStep: new Date().toISOString(),
    },
  },
});

// Final submission
await prisma.user.update({
  where: { id: userId },
  data: {
    kycData: {
      ...user.kycData,
      currentKycStep: 5,
      submittedAt: new Date().toISOString(),
    },
    kycStatus: 'PENDING', // Admin review required
  },
});
```

## User.kycDocuments (JSON)

Stores references to uploaded KYC documents (S3 URLs or local paths).

### Structure

```typescript
interface KycDocuments {
  panCard?: DocumentMetadata;
  aadhaarFront?: DocumentMetadata;
  aadhaarBack?: DocumentMetadata;
  bankProof?: DocumentMetadata;
}

interface DocumentMetadata {
  url: string; // S3 URL or local path
  uploadedAt: string; // ISO timestamp
  fileSize: number; // bytes
  mimeType: string; // e.g., 'image/jpeg', 'application/pdf'
}
```

### Example Usage

```typescript
// Store uploaded document reference
await prisma.user.update({
  where: { id: userId },
  data: {
    kycDocuments: {
      ...user.kycDocuments,
      panCard: {
        url: 's3://bucket/users/{userId}/pan_card.jpg',
        uploadedAt: new Date().toISOString(),
        fileSize: 524288, // 512 KB
        mimeType: 'image/jpeg',
      },
    },
  },
});

// Check if all documents uploaded
const user = await prisma.user.findUnique({ where: { id: userId } });
const docs = user.kycDocuments;
const allUploaded = docs?.panCard && docs?.aadhaarFront && docs?.aadhaarBack && docs?.bankProof;
```

## Database Indexes

For efficient querying, a composite index is created:

```sql
CREATE INDEX "User_kycStatus_currentStep_idx" ON "User"("kycStatus", "currentStep");
```

This optimizes queries like:
- Find all users in KYC process: `WHERE currentStep = 3`
- Find pending KYC submissions: `WHERE kycStatus = 'PENDING' AND currentStep = 3`
- Admin KYC dashboard: Filter by status and step

## KYC Status Values

The `kycStatus` field (String) can have:

- `PENDING` - Default, or submitted for review
- `VERIFIED` - Admin approved KYC
- `REJECTED` - Admin rejected KYC (user needs to resubmit)

## Mock Mode Configuration

For development/testing, set in `.env`:

```env
KYC_MOCK_MODE=true
```

In mock mode:
- Skip real API calls to KYC providers
- Auto-verify PAN/Aadhaar (or simulate verification delays)
- Skip penny drop for bank verification
- Log actions instead of actual API requests

## Migration

The KYC data fields were added via migration:

```
prisma/migrations/20251219071941_add_kyc_data_and_documents/
```

Migration SQL:
```sql
ALTER TABLE "User" ADD COLUMN "kycData" JSONB;
ALTER TABLE "User" ADD COLUMN "kycDocuments" JSONB;
CREATE INDEX "User_kycStatus_currentStep_idx" ON "User"("kycStatus", "currentStep");
```

## Backward Compatibility

- Existing users have `kycData = null` and `kycDocuments = null`
- No data migration required
- Existing authentication flows unaffected
- Users with `currentStep < 3` won't have KYC data (expected behavior)

## Admin KYC Review Flow

1. User submits KYC (`currentKycStep: 5`, `kycStatus: 'PENDING'`)
2. Admin queries pending KYC submissions:
   ```typescript
   const pendingKyc = await prisma.user.findMany({
     where: {
       currentStep: 3,
       kycStatus: 'PENDING',
       kycData: {
         path: ['currentKycStep'],
         equals: 5,
       },
     },
   });
   ```
3. Admin reviews documents and data
4. Admin approves:
   ```typescript
   await prisma.user.update({
     where: { id: userId },
     data: {
       kycStatus: 'VERIFIED',
       currentStep: 4, // Move to post-KYC step
     },
   });
   // Send verification success email
   ```
5. Admin rejects:
   ```typescript
   await prisma.user.update({
     where: { id: userId },
     data: {
       kycStatus: 'REJECTED',
       // Keep currentStep: 3 so user can resubmit
     },
   });
   // Send rejection email with reason
   ```

## Testing Checklist

- [x] Run migration successfully
- [x] Verify columns exist in database
- [x] Check index created (`User_kycStatus_currentStep_idx`)
- [ ] Test existing user queries (should return `kycData: null`)
- [ ] Test creating new user with KYC data
- [ ] Test updating existing user with KYC data
- [x] Verify Prisma Client types include new fields
- [ ] Restart all services to load new schema
- [ ] Test KYC email functionality

## Future Enhancements (Phase 3+)

- Real KYC API integration (Digio/Signzy)
- Document OCR for auto-fill
- Face verification (liveness check)
- Video KYC option
- Bulk KYC approval tools for admins
- KYC expiry and re-verification flows
