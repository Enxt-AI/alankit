# Auth Service

Authentication service for Unlisted StoX platform built with NestJS. Provides phone-first authentication with optional Google OAuth linking.

## Features

- **Phone-First Authentication**: Users start with phone OTP verification
- **Google OAuth Integration**: Optional linking for enhanced features
- **JWT Token Management**: HTTP-only cookies for secure session management
- **Rate Limiting**: Redis-based protection against OTP abuse
- **Admin Authentication**: Separate login flows for administrators

## Authentication Flow

### New User (Phone-First)
1. User enters phone number
2. `POST /auth/phone/otp/request` → Receive OTP via SMS
3. `POST /auth/phone/otp/verify` → Get `{needsGoogle: true, phone}`
4. User clicks "Continue with Google"
5. `POST /auth/phone/google/link` → Link Google account, get JWT token
6. Redirect to dashboard

### Existing User (Phone-Only Login)
1. User enters phone number
2. `POST /auth/phone/otp/request` → Receive OTP via SMS
3. `POST /auth/phone/otp/verify` → Get `{needsGoogle: false, token}` + cookie set
4. Redirect to dashboard (skip Google)

### Legacy Google-First (Backward Compatible)
1. `POST /auth/sync` → Direct Google OAuth login
2. Creates user with email, sets `currentStep=1`

## API Endpoints

### Phone-First Authentication

#### Request Phone OTP
```http
POST /auth/phone/otp/request
Content-Type: application/json

{
  "phone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

#### Verify Phone OTP
```http
POST /auth/phone/otp/verify
Content-Type: application/json

{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Response (New User - needs Google):**
```json
{
  "success": true,
  "needsGoogle": true,
  "phone": "9876543210"
}
```

**Response (Existing User - has email):**
```json
{
  "success": true,
  "needsGoogle": false,
  "currentStep": 1,
  "token": "jwt_token_here"
}
```

#### Link Google to Phone
```http
POST /auth/phone/google/link
Content-Type: application/json

{
  "phone": "9876543210",
  "email": "user@example.com",
  "name": "John Doe",
  "googleId": "google_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "currentStep": 1,
  "token": "jwt_token_here"
}
```

### Legacy Endpoints

#### Google OAuth Sync
```http
POST /auth/sync
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "googleId": "google_id_here"
}
```

#### Get User Profile
```http
GET /auth/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "phone": "9876543210",
  "fullName": "John Doe",
  "currentStep": 1,
  "kycStatus": "PENDING",
  "needsGoogle": false
}
```

## Rate Limiting

- **OTP Requests**: 3 requests per phone per 15 minutes
- **OTP Verification**: 5 attempts per phone per 15 minutes
- **Error Messages**:
  - `"Too many OTP requests. Try again in 15 minutes"`
  - `"Too many verification attempts. Try again in 15 minutes"`

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stocks"

# Server
PORT=3002
NODE_ENV=development

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-in-production-use-long-random-string

# Google OAuth Configuration
GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET_HERE

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate Limiting (Phone OTP)
PHONE_OTP_REQUEST_LIMIT=3        # Max OTP requests per phone per window
PHONE_OTP_REQUEST_WINDOW=900     # Window in seconds (15 min)
PHONE_OTP_VERIFY_LIMIT=5         # Max verify attempts per phone per window
PHONE_OTP_VERIFY_WINDOW=900      # Window in seconds (15 min)
```

## Migration Notes

### From Google-First to Phone-First

The authentication system maintains backward compatibility:

- **Existing Users**: Users with email can log in via phone OTP only
- **New Users**: Must verify phone first, then optionally link Google
- **currentStep Values**:
  - `0`: New user (no auth)
  - `0.5`: Phone-only verified (no email/Google yet)
  - `1`: Phone + Email/Google verified (full signup)
  - `2`: KYC completed

### Database Changes

- `currentStep` column changed from `Int` to `Decimal` to support fractional steps
- Composite index on `[phone, email]` for efficient lookups
- Migration: `20260128150641_currentstep_decimal_type`

## Security Considerations

1. **Rate Limiting**: Prevents brute-force OTP attacks and SMS spam
2. **Public Endpoints**: Phone OTP endpoints don't require authentication
3. **Phone Uniqueness**: Enforced at database level
4. **Email Uniqueness**: Checked before Google linking
5. **OTP Expiry**: 5-minute TTL in Redis
6. **Retry Limits**: Max 5 verification attempts per OTP
7. **Cookie Security**: HTTP-only, SameSite=lax, secure in production

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run start:dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## Testing Checklist

### New User Flow
1. `POST /phone/otp/request` with phone → Receive OTP
2. `POST /phone/otp/verify` with phone + OTP → `{needsGoogle: true}`
3. `POST /phone/google/link` with Google data → JWT token + cookie

### Existing User Flow
1. `POST /phone/otp/request` with existing phone → Receive OTP
2. `POST /phone/otp/verify` with phone + OTP → `{needsGoogle: false, token}`

### Rate Limiting
1. Request OTP 4 times in 15 min → Rate limit error
2. Verify OTP with wrong code 6 times → Rate limit error

### Edge Cases
1. Verify expired OTP → Error
2. Link Google with existing email → Error
3. Link Google without phone verification → Error

