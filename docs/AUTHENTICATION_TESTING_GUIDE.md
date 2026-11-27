# Authentication Testing Guide

## Overview

This guide provides comprehensive testing procedures for the direct backend authentication system implemented in the Unlisted Stocks application. The authentication system uses separate cookies for Admin Panel (`admin_panel_token`) and CMS Panel (`cms_panel_token`) set directly on the stocks-service domain (localhost:3003).

### Architecture Overview

- **Authentication Method:** Direct backend calls to stocks-service endpoints (`/api/auth/admin/*`, `/api/auth/cms/*`)
- **Cookie Domain:** Cookies are set on `localhost:3003` (stocks-service) to match API call destinations
- **Session Isolation:** Admin Panel and CMS Panel use separate cookies for complete session isolation
- **Separate Panel Logins:** All roles, including SUPER_ADMIN, must login separately to each panel for true session isolation

### Cookie Details

| Cookie Name         | Purpose                    | Domain         | Accessible Panels | User Roles                          |
| ------------------- | -------------------------- | -------------- | ----------------- | ----------------------------------- |
| `admin_panel_token` | Admin Panel authentication | localhost:3003 | Admin Panel       | ADMIN, SUPER_ADMIN                  |
| `cms_panel_token`   | CMS Panel authentication   | localhost:3003 | CMS Panel         | CONTENT_MANAGER, ADMIN, SUPER_ADMIN |

**Important:** All authentication cookies are now set exclusively on `localhost:3003` (stocks-service domain). Previous references to checking cookies on `localhost:3002` (auth-service) are outdated and should be ignored. The direct backend authentication architecture eliminated the need for auth-service cookies.

### SUPER_ADMIN Auto-Login Behavior

**Session Isolation:** All roles, including SUPER_ADMIN, must login separately to each panel for true session isolation. This ensures enhanced security and prevents unintended cross-panel access.

## Testing Prerequisites

### Required Tools

- **Browser DevTools:** For cookie inspection and network monitoring
- **Backend Console Access:** To monitor authentication logs
- **Multiple Browser Windows/Tabs:** For testing concurrent sessions

### Setup Steps

1. **Start Services:**

   ```bash
   # Terminal 1: Start stocks-service
   cd apps/stocks-service && pnpm run start:dev

   # Terminal 2: Start web app
   cd apps/web && pnpm run dev
   ```

2. **Clear Cookies Before Testing:**
   - Open browser DevTools (F12)
   - Go to Application/Storage > Cookies > localhost:3003
   - Delete all cookies
   - Refresh the page

3. **Monitor Backend Logs:**
   - Watch stocks-service console for authentication messages
   - Look for JWT strategy validation logs
   - Monitor cookie setting confirmations

## Test Scenarios

### 1. Super Admin Testing Scenarios

#### Test 1.1: Admin Panel Login

**Objective:** Verify Super Admin can login to Admin Panel and cookies are set correctly

**Steps:**

1. Navigate to `http://localhost:3000/admin/login`
2. Login with Super Admin credentials
3. Check browser DevTools > Application > Cookies > localhost:3003
4. Verify only `admin_panel_token` is set (no `cms_panel_token` until separate CMS login)
5. Navigate to Admin Dashboard and verify statistics load without 401 errors

**Expected Results:**

- Only `admin_panel_token` present on localhost:3003
- `cms_panel_token` is not set until separate CMS login is performed
- Cookies have HttpOnly, Secure flags
- Admin Panel dashboard loads successfully
- API calls to `/api/stats/*` succeed

**Backend Console Logs:**

```
[JwtStrategy] Validating admin token for user: superadmin@example.com
[AuthController] Admin login successful for user: superadmin@example.com
[AuthController] Setting admin_panel_token cookie
```

#### Test 1.2: CMS Panel Access After Admin Login

**Objective:** Verify SUPER_ADMIN must login separately to CMS Panel (no auto-login)

**Steps:**

1. Complete Test 1.1 (Admin Panel login)
2. Open new tab and navigate to `http://localhost:3000/cms/login`
3. Verify CMS login page is displayed (no automatic redirect)
4. Login with same SUPER_ADMIN credentials to CMS Panel
5. Check that CMS features (static pages, FAQs, blogs) load after explicit login

**Expected Results:**

- CMS login page displayed (no auto-redirect)
- Separate login required for CMS access
- CMS features load successfully after login
- API calls to `/api/content/*` succeed

#### Test 1.3: Session Isolation - Admin Logout

**Objective:** Verify CMS session persists when logging out of Admin Panel

**Steps:**

1. Complete Test 1.1 (Admin Panel login)
2. Logout from Admin Panel
3. Check cookies - only `cms_panel_token` should remain
4. Navigate to CMS Panel - should still be logged in
5. Verify CMS functionality still works

**Expected Results:**

- Only `cms_panel_token` remains after Admin logout
- CMS Panel remains accessible
- Admin Panel requires re-login

#### Test 1.4: Session Isolation - CMS Logout

**Objective:** Verify Admin session persists when logging out of CMS Panel

**Steps:**

1. Complete Test 1.1 (Admin Panel login)
2. Logout from CMS Panel
3. Check cookies - only `admin_panel_token` should remain
4. Navigate to Admin Panel - should still be logged in
5. Verify Admin functionality still works

**Expected Results:**

- Only `admin_panel_token` remains after CMS logout
- Admin Panel remains accessible
- CMS Panel requires re-login

#### Test 1.5: Session Persistence After Refresh

**Objective:** Verify sessions persist across page refreshes

**Steps:**

1. Complete Test 1.1 (Admin Panel login)
2. Refresh Admin Panel page
3. Refresh CMS Panel page (in separate tab)
4. Verify both panels remain logged in and functional

**Expected Results:**

- Both panels maintain login state after refresh
- No re-authentication required
- Cookies persist in browser

### 2. Regular Admin Testing Scenarios

#### Test 2.1: Admin Panel Login (No Auto-Login)

**Objective:** Verify regular Admin gets only Admin Panel access

**Steps:**

1. Clear all cookies
2. Login to Admin Panel with regular Admin credentials
3. Check cookies - only `admin_panel_token` should be set
4. Try accessing CMS Panel - should require login

**Expected Results:**

- Only `admin_panel_token` cookie set
- No `cms_panel_token` cookie
- CMS Panel requires separate login

#### Test 2.2: CMS Panel Login with Admin Credentials

**Objective:** Verify Admin role can access CMS Panel

**Steps:**

1. Complete Test 2.1 (Admin Panel login)
2. Login to CMS Panel with same Admin credentials
3. Verify access granted and `cms_panel_token` set
4. Check both cookies are now present

**Expected Results:**

- Both cookies present after CMS login
- CMS Panel accessible
- Full CMS functionality available

#### Test 2.3: Admin Panel Features Testing

**Objective:** Verify all Admin Panel features work without 401 errors

**Test Pages/Features:**

- `/admin/dashboard` - Statistics and overview
- `/admin/stocks` - Stock management
- `/admin/orders` - Order management
- `/admin/faqs` - FAQ management
- `/admin/static-pages` - Static page management

**Expected Results:**

- All pages load without 401 errors
- API calls succeed
- CRUD operations work correctly

### 3. Content Manager Testing Scenarios

#### Test 3.1: CMS Panel Login

**Objective:** Verify Content Manager gets only CMS access

**Steps:**

1. Clear all cookies
2. Login to CMS Panel with Content Manager credentials
3. Check cookies - only `cms_panel_token` should be set
4. Try accessing Admin Panel - should be denied

**Expected Results:**

- Only `cms_panel_token` cookie set
- No `admin_panel_token` cookie
- Admin Panel access denied with appropriate error

#### Test 3.2: Admin Panel Access Denied

**Objective:** Verify Content Manager cannot access Admin Panel

**Steps:**

1. Complete Test 3.1 (CMS login)
2. Navigate to `http://localhost:3000/admin/dashboard`
3. Verify redirect to login or access denied message

**Expected Results:**

- Access denied for Admin Panel
- Appropriate error message displayed
- No `admin_panel_token` cookie created

#### Test 3.3: CMS Features with Permissions

**Objective:** Verify Content Manager has appropriate CMS access

**Test Features:**

- Static pages management
- FAQ management
- Blog management
- News management
- Audit logs (read-only)

**Expected Results:**

- Permitted features accessible
- Permission-restricted features properly hidden/blocked

### 4. Cookie Domain Verification

#### Test 4.1: Cookie Properties Inspection

**Objective:** Verify cookies have correct security properties

**Steps:**

1. Login to any panel
2. Open DevTools > Application > Cookies > localhost:3003
3. Inspect cookie properties for both panel tokens

**Expected Cookie Properties:**

- **Domain:** localhost:3003
- **Path:** /
- **HttpOnly:** true (prevents JavaScript access)
- **Secure:** false (localhost doesn't require HTTPS)
- **SameSite:** Lax or Strict
- **Max-Age:** Appropriate expiration (e.g., 86400 = 24 hours)

#### Test 4.2: Network Request Verification

**Objective:** Verify cookies are sent with API requests

**Steps:**

1. Login to Admin Panel
2. Open DevTools > Network tab
3. Navigate to a page that makes API calls (e.g., dashboard)
4. Inspect API request headers

**Expected Results:**

- Cookies automatically included in request headers
- No manual Authorization headers needed
- API calls succeed with 200 status

### 5. Edge Cases and Error Scenarios

#### Test 5.1: Expired Token Handling

**Objective:** Verify graceful handling of expired tokens

**Steps:**

1. Login and wait for token to expire (or manually expire cookie)
2. Attempt to access protected page
3. Verify redirect to login page

**Expected Results:**

- Automatic redirect to login
- Clear error message
- Expired cookie removed

#### Test 5.2: Invalid Token Handling

**Objective:** Verify handling of malformed tokens

**Steps:**

1. Manually modify cookie value in DevTools
2. Attempt to access protected page
3. Verify error handling

**Expected Results:**

- Authentication fails gracefully
- Redirect to login
- Error logged in backend

#### Test 5.3: Concurrent Sessions

**Objective:** Verify multiple browser sessions work independently

**Steps:**

1. Login in Chrome as Super Admin
2. Login in Firefox as different user
3. Verify sessions don't interfere
4. Logout in one browser, verify other remains active

**Expected Results:**

- Independent session management
- No cross-browser interference
- Proper cookie isolation

### 6. Middleware Protection Testing

#### Test 6.1: Direct URL Access Without Login

**Objective:** Verify middleware blocks unauthorized access

**Steps:**

1. Clear all cookies
2. Directly navigate to protected URLs:
   - `http://localhost:3000/admin/dashboard`
   - `http://localhost:3000/cms/dashboard`

**Expected Results:**

- Redirect to appropriate login page
- No access to protected content

#### Test 6.2: Wrong Panel Cookie Testing

**Objective:** Verify CMS cookie doesn't grant Admin access

**Steps:**

1. Login to CMS Panel only
2. Attempt to access Admin Panel
3. Verify access denied despite having valid cookie

**Expected Results:**

- Access denied
- Panel-specific cookie validation

## Expected Results Summary

### Cookie State Matrix

| User Role       | Admin Login | CMS Login | Admin Panel Access | CMS Panel Access | Cookies After Admin Login | Cookies After CMS Login |
| --------------- | ----------- | --------- | ------------------ | ---------------- | ------------------------- | ----------------------- |
| SUPER_ADMIN     |             |           |                    |                  | admin_panel_token         | cms_panel_token         |
| ADMIN           |             |           |                    |                  | admin_panel_token         | cms_panel_token         |
| CONTENT_MANAGER | ❌          |           | ❌                 |                  | (none)                    | cms_panel_token         |

### API Endpoint Authentication

| Endpoint Pattern | Required Cookie   | User Roles                          |
| ---------------- | ----------------- | ----------------------------------- |
| `/api/stats/*`   | admin_panel_token | ADMIN, SUPER_ADMIN                  |
| `/api/stocks/*`  | admin_panel_token | ADMIN, SUPER_ADMIN                  |
| `/api/orders/*`  | admin_panel_token | ADMIN, SUPER_ADMIN                  |
| `/api/content/*` | cms_panel_token   | CONTENT_MANAGER, ADMIN, SUPER_ADMIN |
| `/api/faqs/*`    | cms_panel_token   | CONTENT_MANAGER, ADMIN, SUPER_ADMIN |

## Debugging Guide

### Backend Logs to Monitor

**Successful Authentication:**

```
[JwtStrategy] Validating admin token for user: admin@example.com
[AuthController] Admin login successful
[AuthController] Setting admin_panel_token cookie
```

**Failed Authentication:**

```
[JwtStrategy] Token validation failed: TokenExpiredError
[AuthController] Authentication failed: Invalid credentials
```

### Frontend Debugging

**Check Network Tab:**

- Verify cookies are sent with API requests
- Look for 401 responses indicating auth failures
- Check CORS headers if cross-origin issues occur

**Check Console Logs:**

- Auth store state changes
- API client request/response logs
- Authentication hook logs

### Common Issues and Solutions

**Issue: 401 Errors on API Calls**

- **Cause:** Cookies not set on correct domain
- **Solution:** Verify cookies are on localhost:3003, not localhost:3000

**Issue: Infinite Redirects**

- **Cause:** Middleware not recognizing valid cookies
- **Solution:** Check cookie names match middleware expectations

**Issue: Session Not Persisting**

- **Cause:** Cookies not set with proper flags
- **Solution:** Verify HttpOnly and SameSite settings

**Issue: Cross-Panel Access**

- **Cause:** Wrong cookie being used for panel
- **Solution:** Verify panel-specific cookie validation

## Testing Checklist

### Authentication Flow

- [ ] Super Admin Admin Panel login
- [ ] Super Admin separate panel login verification
- [ ] Regular Admin login (no auto-login)
- [ ] Content Manager login
- [ ] Role-based access control

### Cookie Management

- [ ] Cookies set on correct domain (localhost:3003)
- [ ] Proper cookie security flags (HttpOnly, SameSite)
- [ ] Separate cookies for each panel
- [ ] Cookie cleanup on logout

### API Authentication

- [ ] No 401 errors on protected endpoints
- [ ] Cookies sent with API requests
- [ ] Panel-specific endpoint access
- [ ] Role-based permissions

### Session Isolation

- [ ] Admin logout doesn't affect CMS session
- [ ] CMS logout doesn't affect Admin session
- [ ] Session persistence across refreshes
- [ ] Concurrent sessions in multiple browsers

### Error Handling

- [ ] Expired token handling
- [ ] Invalid token handling
- [ ] Unauthorized access attempts
- [ ] Middleware protection verification

### Edge Cases

- [ ] Direct URL access without login
- [ ] Wrong panel cookie testing
- [ ] Cross-browser session isolation
- [ ] Network interruption handling

## Conclusion

This testing guide verifies that the direct backend authentication system works correctly with:

- Proper cookie domain handling (localhost:3003)
- Separate panel cookies for session isolation
- Role-based access control
- No 401 authentication errors
- Robust error handling and edge case coverage

This testing guide verifies that the direct backend authentication system works correctly with true session isolation between Admin and CMS panels. All roles must login separately to each panel for enhanced security. All authentication flows work seamlessly without the previous proxy route complexity.

---

## Phone-First Authentication (User-Facing)

### Overview

The application now uses phone-first authentication where users authenticate via phone OTP first, then optionally link Google for email collection. This is the default authentication flow for regular users (not admin/CMS panels).

### User Account States

| currentStep | State      | Description                                       | Admin Action Needed    |
| ----------- | ---------- | ------------------------------------------------- | ---------------------- |
| 0.5         | Phone-Only | User completed phone OTP but hasn't linked Google | Monitor for completion |
| 1           | Complete   | User has phone + email (Google linked)            | None                   |

### Database Queries for Admins

```sql
-- Find phone-only users who need Google linking
SELECT id, phone, fullName, createdAt
FROM users
WHERE currentStep = 0.5
ORDER BY createdAt DESC;

-- Find users with pending Google linking
SELECT id, phone, email, fullName, "needsGoogle"
FROM users
WHERE "needsGoogle" = true;
```

### Admin Panel User Management

- **Phone-Only Users (`currentStep: 0.5`):** These users can access limited features but cannot create orders until they link Google
- **Complete Users (`currentStep: 1`):** Full access to all features including order creation
- **`needsGoogle` Flag:** Indicates if Google account linking is pending for enhanced features

### Testing Phone-First Flow

1. **New User:** Phone → OTP → Google Link → Complete
2. **Existing User:** Phone → OTP → Direct Login
3. **Rate Limits:** 3 OTP requests/15min, 5 verify attempts/15min
4. **Edge Cases:** Invalid OTP, expired sessions

### Mock Mode Banner

**Important:** Phone-first authentication is the **default** user authentication flow, not a mock mode. The admin panel's `MockModeBanner` should **NOT** show "Phone-First Active" as it's the permanent architecture (unlike KYC, Payment, or Email mocks).
