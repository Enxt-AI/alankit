# PAN KYC integration

Customers enter only PAN. After signup/login, unverified customers go to `/kyc`.
Checkout requires verified KYC in the Next.js proxy, browser flow, order creation,
and payment creation. Browsing stocks remains available without KYC.

Authenticated customer endpoints:

| Endpoint | Input | Result |
| --- | --- | --- |
| GET `/api/kyc/alankit/status` | None | Masked PAN, state, KYC status and refresh availability |
| POST `/api/kyc/alankit/fetch` | `{ "pan": "ABCDE1234F" }` | Save attempt and fetch provider KYC |
| POST `/api/kyc/alankit/refresh` | `{}` | Fetch again using the saved PAN |

The existing `User.kycData.alankitLookup` JSON stores PAN, attempt ID, state,
timestamp, HTTP status and the latest provider result JSON. No migration is needed.
The raw provider response is excluded from the customer profile response and lookup
responses. No provider data or credentials are logged. Administrative access to KYC
data remains subject to existing admin permissions.

Only a matching PAN, nonempty name, matching registered mobile or email, and provider
status `ACTIVE` produce `VERIFIED`. Another user's PAN claim produces `REVIEW_REQUIRED`.
Verified responses populate the existing PAN, bank and demat data used by orders.
Account details are not separately marked verified. Legacy verified customers remain valid.
Concurrent attempts use compare-and-set updates; verified PAN claims share the existing
PostgreSQL advisory lock with DigiLocker. Refreshes are limited to one per 30 seconds.

## Backend configuration

```dotenv
ALANKIT_KYC_API_KEY=
ALANKIT_KYC_FETCH_CODE=ALGO
ALANKIT_KYC_FETCH_URL=https://obpp.alankit.co.in/api/Kyc/FetchLogin
# Exact top-level JSON code returned with success:false for an absent KYC record.
# Obtain an actual provider response before setting this. No guessed default.
ALANKIT_KYC_NOT_FOUND_CODE=
```

These values belong only in stocks-service's secret/environment configuration.
The API key is sent as `X-API-KEY`; the request body contains `pan` and `fetchCode`.
The PDF specifies a password, but the requester explicitly clarified it is not needed.
That PAN-only contract has not been tested against the live provider.

A configured missing-record code saves `NOT_FOUND` before the frontend redirects to
`https://openaccount.alankit.co.in/`. Inactive records remain `PENDING` with an account-opening
link. Returning users use “check again” at `/kyc`; no callback parameter can set VERIFIED.
There is no documented provider callback or scheduled polling contract.
Unknown failures, missing configuration, invalid JSON, timeouts, 401/403, 429 and 5xx
save `ERROR` and allow retry; they never imply a missing account or unlock purchases.
Without a confirmed not-found code, automatic missing-record redirects remain disabled.

## Local verification

Run `postman simulation run postman/simulations/alankit-kyc.sim.yaml --port 4511 --no-history`.
Then set `KYC_TEST_URL=http://127.0.0.1:4511/alankit/api/Kyc/FetchLogin` and run
`node scripts/test-alankit-kyc.cjs` from the repository root.
Without `KYC_TEST_URL`, the test automatically starts the same mock directly in Node
on port 4510. This fallback was used because Postman's Windows dataset daemon crashed.
The test uses synthetic profiles and an in-memory database substitute. It does not
establish live provider compatibility or PostgreSQL concurrency behavior.
