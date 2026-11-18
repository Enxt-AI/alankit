# DigiLocker verification reliability

KYC uses PostgreSQL compare-and-set updates on the saved `kycData` snapshot. A competing request receives HTTP 409 and must refresh before retrying. This protection is shared across API replicas; it does not rely on a process-local mutex.

- Session creation claims `CREATING` before calling DigiTap. Recent successful session URLs are reused for five minutes. The creation claim expires after one minute to permit recovery after a crashed process. Session creation is not automatically retried because an upstream timeout can have an ambiguous outcome.
- Result fetching claims `PROCESSING` before calling DigiTap. Completed callbacks reuse the saved result. Claims can be reclaimed after one minute; all provider requests have shorter timeouts. A late response cannot overwrite a reset or a newer claim.
- Results require provider business success, a valid complete PAN, a full or masked Aadhaar number, and Aadhaar name and date of birth from the current response. Previous-session identity fields cannot fill gaps. Final submission requires both identities and a matching verified transaction ID.
- Full PAN claims use a PostgreSQL transaction advisory lock before duplicate lookup and persistence. Masked Aadhaar suffixes are never unique keys. Different PAN values normally proceed independently. All application paths that add a new verified PAN must follow this lock protocol; it is not a database unique constraint.
- The accepted identity and its document records commit together. Submission and reset also reject stale writes. Duplicate submissions do not repeat approval notifications.
- Visible clients poll only processing or submitted KYC, backing off from 20 seconds to two minutes. Failed callbacks expose a retry action.

No migration is required. Existing already-verified accounts retain their status. Pending attempts without a matching `verifiedTransactionId` must fetch valid DigiLocker details before submission.

## Validation and capacity limits

The unit regression suite simulates competing requests and stale responses. Run:

```sh
pnpm --filter stocks-service exec jest --runInBand kyc.service.spec.ts digilocker-concurrency.spec.ts
pnpm --filter stocks-service exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
```

A deployment smoke test must confirm the DigiTap response contract. A real PostgreSQL multi-replica test is still needed to measure lock contention and throughput. Current provider calls remain synchronous and notifications are best effort. Durable background processing, account-wide rate limiting, provider webhook recovery, and load testing are separate capacity work; these concurrency fixes do not increase the DigiTap account quota.
