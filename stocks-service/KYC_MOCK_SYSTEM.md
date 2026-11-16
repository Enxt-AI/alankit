# Mock KYC Verification System

## Overview

This document describes the mock KYC verification system implemented in the stocks-service. The system simulates a complete multi-step KYC flow with realistic delays, allowing for development and testing without integrating real KYC APIs (Digio, Signzy, etc.).

## Environment Configuration

Toggle between mock and production mode using the `KYC_MOCK_MODE` environment variable:

```bash
# Mock mode (default) - for development/testing
KYC_MOCK_MODE=true

# Production mode - uses real KYC APIs (requires integration)
KYC_MOCK_MODE=false
```

## Multi-Step KYC Flow

### Step 1: PAN Verification
**Endpoint:** `POST /kyc/verify-pan`

**Request Body:**
```json
{
  "pan": "ABCDE1234F",
  "fullName": "John Doe",
  "dob": "1990-01-15"
}
```

**Mock Behavior:**
- Simulates 2-3 second API delay
- Accepts any valid PAN format (5 letters + 4 digits + 1 letter)
- Always returns success
- Updates `kycData.panDetails` with verification status

**Response:**
```json
{
  "success": true,
  "message": "PAN verified successfully",
  "data": { "verified": true }
}
```

---

### Step 2a: Send Aadhaar OTP
**Endpoint:** `POST /kyc/aadhaar/send-otp`

**Request Body:**
```json
{
  "aadhaar": "123456789012"
}
```

**Mock Behavior:**
- Simulates 2 second API delay
- Generates fake OTP reference ID (`MOCK_REF_<timestamp>`)
- No actual OTP is sent to mobile
- Updates `kycData.aadhaarDetails` with OTP reference

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to Aadhaar-linked mobile",
  "data": {
    "otpRefId": "MOCK_REF_1703001234567"
  }
}
```

---

### Step 2b: Verify Aadhaar OTP
**Endpoint:** `POST /kyc/aadhaar/verify-otp`

**Request Body:**
```json
{
  "otpRefId": "MOCK_REF_1703001234567",
  "otp": "123456"
}
```

**Mock Behavior:**
- Simulates 2 second API delay
- Accepts any 6-digit OTP (no validation against actual OTP)
- Always returns success if format is valid
- Updates `kycData.aadhaarDetails.verified` to true

**Response:**
```json
{
  "success": true,
  "message": "Aadhaar verified successfully"
}
```

---

### Step 3: Bank Details Verification
**Endpoint:** `POST /kyc/bank-details`

**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "ifsc": "SBIN0001234",
  "accountHolderName": "John Doe"
}
```

**Mock Behavior:**
- Simulates 3 second penny drop verification delay
- Accepts any valid IFSC format (4 letters + 7 alphanumeric)
- Always returns success
- Updates `kycData.bankDetails` with verification status

**Response:**
```json
{
  "success": true,
  "message": "Bank details verified successfully"
}
```

---

### Step 4: Document Upload
**Endpoint:** `POST /kyc/upload-document/:documentType`

**Document Types:**
- `panCard` - PAN card image
- `aadhaarFront` - Aadhaar front side
- `aadhaarBack` - Aadhaar back side
- `bankProof` - Bank statement/passbook

**Request:** Multipart form data with `file` field

**File Validation:**
- Allowed types: JPEG, PNG, PDF
- Maximum size: 5MB
- File saved to: `uploads/kyc/{userId}/{documentType}-{timestamp}-{random}.ext`

**Mock Behavior:**
- Validates file type and size
- Stores file metadata in `kycDocuments` JSON field
- Creates user-specific upload directory

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "url": "uploads/kyc/user123/panCard-1703001234567-abc123.jpg"
  }
}
```

---

### Step 5: Submit KYC for Review
**Endpoint:** `POST /kyc/submit`

**Request Body:**
```json
{
  "confirmSubmission": true
}
```

**Validation:**
-  PAN verified
-  Aadhaar verified
-  Bank details verified
-  All 4 documents uploaded

**Mock Behavior:**
- Simulates 5 second review delay
- **Auto-approves** KYC immediately (no manual review)
- Encrypts PAN using bcrypt for storage
- Updates `kycStatus` to `VERIFIED`
- Updates `currentStep` to 4 (KYC completed)
- Generates mock CKYC reference ID
- Sends verification email with mock mode banner

**Response:**
```json
{
  "success": true,
  "message": "KYC submitted and verified successfully"
}
```

**Email Notification:**
- Sends KYC verified email to user
- Includes **⚠️ MOCK MODE** banner in email
- User can now browse and purchase stocks

---

### Get KYC Status
**Endpoint:** `GET /kyc/status`

**Response:**
```json
{
  "kycStatus": "VERIFIED",
  "currentStep": 4,
  "currentKycStep": 5,
  "panVerified": true,
  "aadhaarVerified": true,
  "bankVerified": true,
  "documentsUploaded": {
    "panCard": true,
    "aadhaarFront": true,
    "aadhaarBack": true,
    "bankProof": true
  },
  "canSubmit": true
}
```

---

## Admin Endpoints

### Manually Approve KYC
**Endpoint:** `PUT /kyc/admin/:userId/approve`

**Response:**
```json
{
  "success": true,
  "message": "KYC approved successfully"
}
```

---

### Reject KYC
**Endpoint:** `PUT /kyc/admin/:userId/reject`

**Request Body:**
```json
{
  "reason": "Invalid PAN card - name mismatch"
}
```

**Response:**
```json
{
  "success": true,
  "message": "KYC rejected"
}
```

**Email Notification:**
- Sends KYC rejected email with reason
- Includes **⚠️ MOCK MODE** banner in email
- User can retry KYC process

---

## State Persistence

All KYC progress is stored in the `User` table using JSON fields:

### kycData Field Structure
```json
{
  "currentKycStep": 3,
  "panDetails": {
    "pan": "ABCDE1234F",
    "name": "John Doe",
    "dob": "1990-01-15",
    "verified": true,
    "verifiedAt": "2023-12-20T10:30:00.000Z"
  },
  "aadhaarDetails": {
    "aadhaar": "123456789012",
    "otpSent": true,
    "otpRefId": "MOCK_REF_1703001234567",
    "otpSentAt": "2023-12-20T10:35:00.000Z",
    "verified": true,
    "verifiedAt": "2023-12-20T10:37:00.000Z"
  },
  "bankDetails": {
    "accountNumber": "1234567890",
    "ifsc": "SBIN0001234",
    "accountHolder": "John Doe",
    "verified": true,
    "verifiedAt": "2023-12-20T10:40:00.000Z"
  },
  "documentsUploaded": {
    "panCard": true,
    "aadhaarFront": true,
    "aadhaarBack": true,
    "bankProof": true
  },
  "submittedAt": "2023-12-20T10:45:00.000Z",
  "approvedAt": "2023-12-20T10:45:05.000Z",
  "lastUpdatedStep": "2023-12-20T10:40:00.000Z"
}
```

### kycDocuments Field Structure
```json
{
  "panCard": {
    "url": "uploads/kyc/user123/panCard-1703001234567-abc123.jpg",
    "uploadedAt": "2023-12-20T10:38:00.000Z",
    "fileSize": 245678,
    "mimeType": "image/jpeg"
  },
  "aadhaarFront": { /* ... */ },
  "aadhaarBack": { /* ... */ },
  "bankProof": { /* ... */ }
}
```

### Additional User Fields
- `encryptedPan` - Bcrypt hash of PAN (for secure storage)
- `dob` - Date of birth (from PAN verification)
- `ckycRefId` - Mock CKYC reference ID
- `kycStatus` - Enum: `PENDING` | `VERIFIED` | `REJECTED`
- `currentStep` - 4 when KYC is completed

---

## Mock Mode Indicators

### Email Templates
All KYC-related emails include a yellow banner when in mock mode:

```
WARNING - MOCK MODE: This KYC verification was processed in mock/test mode.
In production, this will use real verification APIs.
```

### Console Logging
Service logs current mode on initialization:
```
KYC Service initialized in MOCK mode
```

---

## Testing Guide

### Complete KYC Flow Test

1. **Verify PAN:**
   ```bash
   curl -X POST http://localhost:3002/kyc/verify-pan \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "pan": "ABCDE1234F",
       "fullName": "Test User",
       "dob": "1990-01-15"
     }'
   ```

2. **Send Aadhaar OTP:**
   ```bash
   curl -X POST http://localhost:3002/kyc/aadhaar/send-otp \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{ "aadhaar": "123456789012" }'
   ```

3. **Verify Aadhaar OTP:**
   ```bash
   curl -X POST http://localhost:3002/kyc/aadhaar/verify-otp \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "otpRefId": "MOCK_REF_1703001234567",
       "otp": "123456"
     }'
   ```

4. **Submit Bank Details:**
   ```bash
   curl -X POST http://localhost:3002/kyc/bank-details \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "accountNumber": "1234567890",
       "ifsc": "SBIN0001234",
       "accountHolderName": "Test User"
     }'
   ```

5. **Upload Documents:**
   ```bash
   curl -X POST http://localhost:3002/kyc/upload-document/panCard \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -F "file=@/path/to/pan.jpg"
   ```

6. **Submit KYC:**
   ```bash
   curl -X POST http://localhost:3002/kyc/submit \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{ "confirmSubmission": true }'
   ```

7. **Check Status:**
   ```bash
   curl -X GET http://localhost:3002/kyc/status \
     -H "Authorization: Bearer <JWT_TOKEN>"
   ```

---

## Future Production Integration

To integrate real KYC APIs:

1. **Set environment variable:**
   ```bash
   KYC_MOCK_MODE=false
   ```

2. **Implement API integrations in `kyc.service.ts`:**
   - Replace mock delays with actual API calls
   - Add Digio SDK for PAN/Aadhaar verification
   - Add Signzy SDK for bank verification
   - Implement webhook handlers for async verification

3. **Update KYC submission:**
   - Remove auto-approval logic
   - Wait for webhook callbacks
   - Store vendor reference IDs
   - Handle verification failures

4. **Security enhancements:**
   - Add rate limiting on OTP endpoints
   - Implement retry limits
   - Add fraud detection rules
   - Encrypt sensitive data at rest

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing/invalid JWT token
- `404 Not Found` - User not found
- `500 Internal Server Error` - Unexpected errors

Error response format:
```json
{
  "statusCode": 400,
  "message": "PAN verification not completed",
  "error": "Bad Request"
}
```

---

## Security Considerations

### Mock Mode
- ✅ Accepts any valid format (no real verification)
- ✅ No external API calls
- ✅ Files stored locally
- ⚠️ **DO NOT use in production**

### Production Mode
- Requires real API integration
- Validates against government databases
- Stores encrypted PAN
- Complies with KYC regulations
- Supports CKYC integration

---

## Support

For questions or issues:
- Check service logs: `docker logs stocks-service`
- Review KYC status: `GET /kyc/status`
- Contact support team for manual approval
