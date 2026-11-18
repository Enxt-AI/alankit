# Payment and KYC reliability

## Changes

- Business timing: receipt vouchers require successful payment (`PAID`/`SUCCESS`), including legacy order and receipt-download paths. Sales vouchers require Operations completion with a transfer reference number, a valid transfer date, and a batch number. The approval form requires all three. Completion rechecks the order under a database lock so concurrent approvals cannot repeat portfolio and sales posting.

- Cashfree webhooks require a valid HMAC over timestamp plus raw request bytes before enqueue. The service returns HTTP 200 only after Redis accepts the event. Raw-body hashes deduplicate repeated deliveries. Successful events also require matching amount, INR currency, and a payment identifier.
- Webhook jobs have eight attempts with exponential backoff, four concurrent handlers per process, and bounded completed/failed retention. Reconciliation runs with two concurrent handlers.
- Cashfree calls have a ten-second deadline per attempt, bounded transient retries, jitter, and shared Redis admission control. Configure `CASHFREE_REQUESTS_PER_SECOND` (default 10) to your actual account quota. Creation carries a stable idempotency key.
- Payment attempts, the paid order, and durable follow-up records commit in one transaction under an order-row lock. Failure events cannot downgrade a paid order. Receipt accounting is attempted immediately after the paid commit, preserving the normal posting timing. The PostgreSQL outbox retries a failed/interrupted receipt posting; email and coupon work use the outbox too.
- Payment status GETs read local state and enqueue a reconciliation job at most once per order per thirty-second bucket. They no longer scan all attempts and call Cashfree for each. Verification uses the canonical merchant order ID; unavailable/unconfirmed results do not mark a payment failed.
- Voucher numbers retain `PREFIX-0001` formatting. Payments, order receipts, and admin accounting all allocate from the same atomic database counter per prefix. The migration seeds counters from the highest existing numeric suffix. Gaps after failed operations are allowed. The existing unique constraint remains the final safeguard.
- Payment and order receipt writers share a per-order database lock and check existing receipt metadata before creating a voucher. A retry reuses the existing receipt; different vouchers receive different numbers.
- KYC preserves compare-and-set claims and PAN advisory locking. An expression index supports the PAN duplicate lookup. DigiTap KYC calls use shared Redis admission control (`DIGITAP_KYC_REQUESTS_PER_SECOND`, default 5).
- KYC result retrieval persists recovery work with its processing claim. Recovery ignores reset/replaced sessions, never creates a new DigiLocker session, and stops on validation failures. Manual uploads now use asynchronous filesystem operations.

## Deployment

Apply migration `20261007000000_integration_reliability` before starting the new workers. Coordinate deployment of payments-service and stocks-service: old voucher allocators must not continue writing after the new counter is seeded. Take the normal database backup and pause voucher-writing traffic during this migration/deployment. The PAN and receipt expression indexes are ordinary index builds; plan their lock time for a large production database.

Build the shared db-unlisted-stox, redis-service, and email-service packages before the services. Run Prisma generation as part of the normal build. No live migration or deployment is performed by this change.

Use persistent Redis with a no-eviction policy for Bull. The repository's local cache Redis eviction configuration is not a production queue durability guarantee. All replicas using the same provider credentials must share the limiter Redis. Defaults are admission limits, not measured provider capacities. Include any other applications sharing those credentials when budgeting quotas.

## Recovery and operations

IntegrationTask workers claim four records per batch with `FOR UPDATE SKIP LOCKED`, five-minute leases, a one-minute work deadline, and exponential retry delays capped at one hour. After twelve failed attempts, the record remains available for investigation and explicit replay. Alert on those rows, queue failed counts, oldest pending age, provider 429s, and database transaction timeouts. Restarting a worker recovers expired leases.

After resolving a task's underlying error, an operator can reset that specific IntegrationTask's attempts to zero and availableAt to the current timestamp. Preserve completed rows as deduplication records; archive them only with a retention policy that preserves business idempotency. Historical paid orders are not automatically emailed or backfilled by this migration.

Accounting transactions and in-app notification IDs are idempotent. Confirmation emails also use a provider idempotency key. External delivery remains at-least-once: provider idempotency retention and unusually late manual replay must be considered. A timed-out task can still complete externally; database operations are idempotent and email retries reuse the key.

## Validation limits

Unit regressions cover raw-body authentication, concurrent settlement modeling, split-settlement recovery, failure downgrade guards, durable retries, voucher uniqueness/retry behavior, and stale DigiLocker recovery. These do not substitute for PostgreSQL/Redis integration and load tests.

Before release, test duplicate and out-of-order webhooks, process crashes after commit, concurrent admin/order/payment voucher creation, a provider outage, and Redis restarts against disposable PostgreSQL and Redis. Measure throughput, p95/p99 latency, queue age, and database pool utilization with realistic data. Verify the Cashfree payload contract in sandbox.

KYC provider requests remain synchronous for the initial user response, with durable result recovery. Legacy manual document uploads still need shared storage across replicas. No production throughput or concurrent-user capacity is claimed.

## Accounting compatibility review

The existing customer-ledger selection rule (active USER ledger by email) and the six-hex-character RCPT receipt format are preserved. No customer ledgers are relinked by the concurrency change. Manual paid overrides retain the existing Cashfree payment identifier rather than manufacturing a gateway ID.

Compared with the repository baseline, the bodies of recordCashfreeSettlement, autoCreatePendingSettlementVouchers, getSettlementVouchersStatus, syncSettlementUtrs, recalculateAllBalances, postApprovedVoucherSideEffects, runManualCashfreeReconciliation, getActiveUnreconciledOrders, getReconciliationHistory, and reconcilePendingSettlements are unchanged. Their shared voucher-number allocator is now atomic; business calculations and entry directions are unchanged.

Compatibility regressions cover receipt debit/credit increments without duplicate posting, sales postings, the existing settlement split (bank net debit + fee/GST debit = Cashfree gross credit), repeated UTR handling, customer-ledger reuse, and preservation of reconciliation/settlement/payment reference fields. Raw webhook data is retained in payment metadata for audit, without logging the complete payload.

These checks use mocked database/provider calls. They do not claim that production balances have been compared or that end-to-end bank settlement has been exercised. Deploy only after applying the prepared migration and completing the integration checks described above.
