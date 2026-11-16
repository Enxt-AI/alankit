# OTP login deployment

Phone and email login use random six-digit codes with a five-minute expiry.
Phone resends have a 30-second cooldown. The fifth wrong attempt immediately
locks verification for 15 minutes. CAPTCHA is not used or required.

Verification, attempt counting, expiry preservation, lockout and successful code
consumption run in one Redis script. A successful code cannot be reused by another
request. Generation locks use ownership tokens; an expired owner cannot overwrite
a newer code or release another request's lock. SMS jobs skip codes already
consumed, superseded or expired.

## Signup state and completion

New users must complete phone OTP, email OTP and a valid full name in that order.
Phone verification creates only a ten-minute Redis phone proof. Email verification
consumes that proof and the email OTP, then stores both contacts as a ten-minute
pending signup in Redis. Neither step inserts a user, updates an incomplete user,
sends a welcome email or issues an authenticated session.

`POST /auth/signup/complete` accepts a trimmed full name (3–100 characters, letters
and spaces). It claims the pending signup once, writes all three fields in a
serializable database transaction, and only then creates the session. It ignores
client-supplied contact details: the contacts come exclusively from verified Redis
state. Conflicts never overwrite another account. Existing incomplete accounts
are completed only at this final step; existing completed accounts still log in
with a single phone or email OTP. Email-only requests cannot create new accounts.

Browser signup state uses HttpOnly cookies, not an authentication cookie. The
login page and popup resume via `GET /auth/signup/status`. Unfinished attempts
expire without leaving new database rows. Invalid names do not consume the
signup token. A valid completion submission claims it once; if the database write
fails, restart verification. If the account committed but the response/session
failed, use the normal login flow. Existing database rows and already issued
sessions from earlier deployments are not deleted by this change.

## Deployment requirements

- Set `NODE_ENV=production` on every auth/worker instance. Fixed email test codes,
  general phone-number allowlists, console OTP logging and local-memory fallbacks are
  disabled in production, including when `ALLOW_CONSOLE_OTP_FALLBACK` is set.
- The reserved Play Store review phone `0123456789` uses `123456` in production
  and skips SMS delivery. Request the OTP first: the hashed code is stored in
  Redis and retains the normal five-minute expiry, verification attempt
  limits and one-time consumption. All other phones use random delivered codes.
  If the review account does not exist yet, verify a real email with its delivered
  code and submit the name once to finish signup. Subsequent logins need only the
  review phone OTP. This is a shared review account accessible with these public
  credentials; use only demo data in it.
  This shared number does not send SMS, so it is exempt from OTP request quotas
  and resend cooldowns, including IP/device/global send budgets. Existing exhausted
  counters and resend cooldowns are ignored after deployment. Failed-verification
  lockouts, one-time code consumption and generation locks still apply. Other
  phone numbers and email addresses keep all limits. Endpoint-level HTTP throttling
  remains in place.
- All auth instances and SMS workers must share the same Redis deployment and
  database. Redis must support Lua scripts. These multi-key scripts target the
  existing standalone Redis configuration, not Redis Cluster with independent
  hash slots. Redis outages reject authentication operations instead of accepting
  inconsistent local state.
- Keep the auth service behind the trusted reverse proxy. Its existing
  `trustProxy: true` configuration assumes that direct public access is blocked
  and the proxy overwrites untrusted forwarding headers.
- Deploy the backend and web changes together. Users midway through the old
  phone-to-email signup must verify their phone again.
- Mobile clients receive `phoneVerificationToken` from phone verification when
  `x-client-type: mobile` is supplied. Send that token with `phone`, `email` and
  `otp` to email verification. It expires after ten minutes and is consumed with
  the email OTP. Browser clients use the HttpOnly `phone_verification` cookie.
  Email verification then returns `needsName: true` and (for mobile) `signupToken`,
  with no login token. Mobile clients send `signupToken`, `fullName` and their
  optional DPoP `publicKey` to `/auth/signup/complete` to receive the login token.
  Browser clients use the HttpOnly `pending_signup` cookie automatically.
  Cookie domain, HTTPS and credentialed requests must be configured correctly.
- Existing default limits remain: 2 sends/minute, 5/15 minutes, 10/hour and 20/day
  per target in production, 30/hour per IP and 500/hour globally. Target limits
  are configurable through `OTP_15MIN_LIMIT`, `OTP_HOURLY_LIMIT` and
  `OTP_DAILY_LIMIT`. Successful login no longer resets hourly/daily budgets.

## Delivery reporting

Queue acceptance returns `smsQueued: true`; it does not claim SMS delivery.
The status endpoint reports `queued`, `retrying`, `accepted` or `failed` for the
current code. The web OTP screen polls that status. `accepted` means the provider
accepted the SMS, not that the handset received it. The synchronous queue-failure
fallback reports provider acceptance in the request response. SMS text now states
the actual five-minute validity. Completed/failed jobs are removed so their
plaintext codes do not accumulate in the queue.

## Verification

Run `pnpm --filter auth-service exec jest --runInBand` and type-check auth-service
and web with `pnpm --filter <package> exec tsc --noEmit`.

On Linux/WSL, run:

```sh
python3 apps/auth-service/test/otp-redis.integration.py /path/to/redis-server
```

This starts and cleans up its own ephemeral Redis server using a Unix socket.
It does not connect to configured application databases or send messages. It
checks concurrent verification, concurrent failures, expiry in the final second,
one-use phone binding, atomic limits, stale lock release and stale delivery jobs.
These are correctness tests, not a capacity benchmark or live SMS delivery test.
