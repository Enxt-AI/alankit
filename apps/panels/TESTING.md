# Testing Guide - SMC Unlisted Stocks

## Manual Verification Checklist for Google OAuth (Phase 3)

### Prerequisites
- [ ] Backend services running:
  - `auth-service` on port 3002
  - `stocks-service` on port 3003
  - PostgreSQL database accessible
  - Redis instance running
- [ ] Frontend dev server running on port 3000
- [ ] Google OAuth Client ID configured in `.env.local`
- [ ] Google Cloud Console properly configured (see README.md)

### Test Steps

#### 1. Start Services
```bash
# Terminal 1: Start backend services
cd apps/auth-service
pnpm dev

# Terminal 2: Start web frontend
cd apps/web
pnpm dev
```

#### 2. Open Application
- [ ] Navigate to `http://localhost:3000`
- [ ] Verify page loads without errors
- [ ] Open browser DevTools Console (F12)

#### 3. Verify Environment
- [ ] Check console for: `[KEY] Google Client ID: ...` (development mode only)
- [ ] Check console for: `[ORIGIN] Current Origin: http://localhost:3000`
- [ ] No errors in console

#### 4. Click "Get Started" Button
- [ ] Auth modal opens
- [ ] Modal displays:
  - Title: "Welcome to SMC Unlisted Stocks"
  - Google Sign-in button
  - Terms footer text

#### 5. Sign In with Google
- [ ] Click "Sign in with Google" button
- [ ] Google account picker appears (popup or embedded)
- [ ] Select your Google account
- [ ] Account must be added as "Test user" in Google Cloud Console

#### 6. Verify Success Flow
- [ ] Success toast appears: "Google login successful!"
- [ ] Auth modal closes automatically
- [ ] No errors in console

#### 7. Verify Token Storage
Open browser DevTools > Application tab (Chrome) or Storage tab (Firefox):
- [ ] Check `browser storage` for key: `partial_token`
- [ ] Token should be a JWT string (three parts separated by dots)
- [ ] Token should not be empty or "undefined"

#### 8. Verify Backend API Call
In browser DevTools > Network tab:
- [ ] Find POST request to: `http://localhost:3002/api/auth/sync`
- [ ] Status code: `200 OK`
- [ ] Response contains:
  ```json
  {
    "token": "...",
    "currentStep": 1,
    "kycStatus": "PENDING"
  }
  ```
- [ ] Request payload contains:
  ```json
  {
    "email": "your@email.com",
    "name": "Your Name",
    "googleId": "..."
  }
  ```

#### 9. Verify HTTP-Only Cookie
In DevTools > Application > Cookies > `http://localhost:3002`:
- [ ] Cookie named `auth_token` exists
- [ ] Cookie has `HttpOnly` flag set
- [ ] Cookie has appropriate expiration

#### 10. Refresh Page
- [ ] Reload `http://localhost:3000`
- [ ] Auth modal should NOT open automatically
- [ ] User state should be preserved (check console if logging is enabled)
- [ ] `partial_token` still in browser storage

---

## Common Issues and Troubleshooting

### Error: "redirect_uri_mismatch"
**Cause:** Google Cloud Console missing authorized origin.

**Fix:**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Edit your OAuth 2.0 Client ID
3. Add to "Authorized JavaScript origins": `http://localhost:3000`
4. Save and wait 5-10 minutes for propagation
5. Clear browser cache or use Incognito mode

### Error: "access_denied" or "Not authorized"
**Cause:** User not added as test user in Google Cloud Console.

**Fix:**
1. Go to Google Cloud Console > APIs & Services > OAuth consent screen
2. Scroll to "Test users"
3. Click "ADD USERS"
4. Add your Google account email
5. Save

### Error: "invalid_client"
**Cause:** Wrong Client ID in `.env.local` or client ID not found.

**Fix:**
1. Verify Client ID in Google Cloud Console matches `.env.local`
2. Ensure `.env.local` exists (not just `.env`)
3. Restart dev server after changing `.env.local`
4. Check console log shows correct Client ID

### Backend Error: POST /auth/sync returns 400 or 500
**Cause:** Backend service issue or database connection problem.

**Fix:**
1. Check `auth-service` terminal for error logs
2. Verify PostgreSQL is running and accessible
3. Verify Prisma migrations are applied
4. Check database connection string in backend `.env`

### Token Not Stored in browser storage
**Cause:** /auth/sync call failed or returned error.

**Fix:**
1. Check Network tab for /auth/sync response
2. Look for error in response body
3. Check backend logs for detailed error
4. Verify token is returned in response JSON

### Modal Doesn't Close After Success
**Cause:** JavaScript error in success handler or state not updating.

**Fix:**
1. Check browser console for errors
2. Verify `closeAuthModal()` is called in `handleGoogleSuccess`
3. Check Zustand store state in React DevTools

### "400 malformed request" from Google
**Cause:** Most common - missing authorized origin in Google Cloud Console.

**Fix:** See "redirect_uri_mismatch" fix above.

---

## Advanced Verification

### Decode JWT Token
```javascript
// Run in browser console
const token = browser storage.getItem('partial_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token payload:', payload);
// Should contain: userId, email, exp, iat, etc.
```

### Check Token Expiry
```javascript
// Run in browser console
const token = browser storage.getItem('partial_token');
const payload = JSON.parse(atob(token.split('.')[1]));
const expiryDate = new Date(payload.exp * 1000);
console.log('Token expires:', expiryDate);
console.log('Is expired:', Date.now() > payload.exp * 1000);
```

### Verify Authorization Header
In Network tab, check any subsequent API request:
- Headers should include: `Authorization: Bearer <token>`
- Token should match `partial_token` from browser storage

---

## Phase 4 Preview (OTP Phone Verification)

### Expected Changes
- [ ] Modal will NOT close after Google success if `currentStep === 1`
- [ ] OTP form will appear in modal after Google auth
- [ ] Phone number input and verification code input
- [ ] SMS/OTP verification before modal closes

### Integration Points to Test Later
- [ ] `currentStep` increments from 1 to 2 after OTP verification
- [ ] Token remains valid through OTP flow
- [ ] Modal closes only after `currentStep >= 2`

---

## Admin Banner Verification
---

## Automated Testing (Future)

### Unit Tests Needed
- [ ] `decodeToken()` handles base64url encoding correctly
- [ ] `getStoredToken()` returns null in SSR context
- [ ] `useAuthStore` login action handles errors
- [ ] Google credential validation (email and sub required)

### Integration Tests Needed
- [ ] Full OAuth flow from button click to token storage
- [ ] Token refresh on page reload
- [ ] Error handling for invalid tokens
- [ ] Logout clears token and resets state

### E2E Tests Needed (Playwright/Cypress)
- [ ] Complete auth flow with mock Google OAuth
- [ ] Modal open/close behavior
- [ ] Network request verification
- [ ] browser storage state verification

