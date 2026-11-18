# Phone-First Authentication Testing Guide

## Overview
Users now authenticate via phone OTP first, then link Google for email (new users) or login directly (existing users).

## Test Scenarios

### New User Signup
1. Enter phone number → Click "Send OTP"
2. Verify OTP received (check console in dev mode)
3. Enter OTP → Click "Verify"
4. Modal shows Google button
5. Click Google → Account created → Redirect to dashboard

### Existing User Login
1. Enter phone number → Send OTP
2. Enter OTP → Verify
3. Immediate redirect to dashboard (no Google)

### Rate Limiting Tests
1. Request OTP 3 times in 15 min → 4th attempt blocked
2. Enter wrong OTP 5 times → 6th attempt blocked
3. Wait 15 min → Limits reset

### Edge Cases
1. Close tab during Google step → Reopen → Phone OTP → Resume Google linking
2. Invalid phone format → Error message
3. Expired OTP (5 min) → "OTP expired" error

## Environment Setup
- `PHONE_OTP_REQUEST_LIMIT=3` (test with lower values like 2 for faster testing)
- `PHONE_OTP_VERIFY_LIMIT=5`
- Twilio credentials required for real SMS (or use console logs in dev)

## API Endpoints
- `POST /auth/phone/otp/request` - Send OTP (public)
- `POST /auth/phone/otp/verify` - Verify OTP (public)
- `POST /auth/phone/google/link` - Link Google (public)

## Database States

### Phone-Only User (currentStep: 0.5)
```sql
SELECT * FROM users WHERE currentStep = 0.5;
-- Shows users who completed phone OTP but haven't linked Google
```

### Complete User (currentStep: 1)
```sql
SELECT * FROM users WHERE currentStep = 1;
-- Shows fully authenticated users with email
```

## Redis Keys (Rate Limiting)
- `rate:otp:request:PHONE` - OTP request counters
- `rate:otp:verify:PHONE` - OTP verification counters

## Common Issues

### OTP Not Received
- Check Twilio credentials in `.env`
- Verify phone number format (+91XXXXXXXXXX)
- Check Redis connection for rate limiting

### Google Link Fails
- Verify Google OAuth client ID/secret
- Check if phone number matches verified user

### Rate Limiting Too Aggressive
- Temporarily reduce limits in `.env` for testing
- Clear Redis keys: `redis-cli KEYS "rate:*" | xargs redis-cli DEL`

## Admin Panel Integration

### User Management
- Users with `currentStep: 0.5` need Google linking
- Users with `currentStep: 1` are fully authenticated
- `needsGoogle` field indicates pending Google setup

### Mock Mode Banner
- Phone-first is the default authentication (not a mock mode)
- Banner should NOT show "Phone-First Active"
- Only shows for services like KYC, Payment, Email

## Performance Testing

### Load Testing
```bash
# Test OTP request rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3001/auth/phone/otp/request \
    -H "Content-Type: application/json" \
    -d '{"phone":"+919876543210"}' &
done
```

### Concurrent Users
- Test 100 simultaneous OTP requests
- Verify Redis handles distributed rate limiting
- Check database connection pooling

## Security Checklist

- [ ] OTP expires after 5 minutes
- [ ] Rate limits prevent brute force (3 req/15min, 5 verify/15min)
- [ ] Phone numbers validated before OTP send
- [ ] JWT tokens HTTP-only, secure cookies
- [ ] Failed attempts logged for monitoring
- [ ] Google OAuth state parameter prevents CSRF

## Deployment Notes

### Environment Variables
```env
# Production Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# Rate Limiting
PHONE_OTP_REQUEST_LIMIT=3
PHONE_OTP_REQUEST_WINDOW=900
PHONE_OTP_VERIFY_LIMIT=5
PHONE_OTP_VERIFY_WINDOW=900

# Throttler (NestJS)
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

### Monitoring
- Set up alerts for high OTP failure rates
- Monitor Redis memory usage for rate limit keys
- Track user conversion: phone-only → complete signup

### Rollback Plan
- Keep old Google-first endpoints active during transition
- Use feature flags if needed for gradual rollout
- Monitor error rates and user feedback