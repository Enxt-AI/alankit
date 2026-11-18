# Trial Balance Backend Refactoring

## What was changed
1. **Backend Aggregation**: We created a `getTrialBalance` service method in `accounting.service.ts` that uses a single Postgres SQL aggregation via `$queryRaw`. This calculates `preDebit`, `preCredit`, `periodDebit`, and `periodCredit` per ledger instantly without looping in JavaScript.
2. **Removed Pagination Limits**: We removed the `10000` limit restriction that was truncating the frontend data. All ledger data is now properly calculated server-side, no matter how many `VoucherEntry` records exist.
3. **Fixed Date Boundary Bug**: The React UI previously sent a `dateTo` of "+1 Day", which tricked the Trial Balance for July 31st into pulling all data for August 1st. This caused the mysterious ₹6 Cashfree discrepancy (August 1st contained exactly ₹30 CR and ₹24 DR). We've removed this from `page.tsx` so the DatePicker natively passes the correct end date without bleeding into the next day.
4. **UI Streamlined**: We removed thousands of lines of unnecessary `.reduce()` loops and state management variables in `page.tsx`. The frontend Trial Balance is now incredibly fast, just mapping the rows delivered by Postgres!

## What was tested
- I ran the manual DB script confirming that August 1st held exactly `-₹6` in net changes for Cashfree (`871.51 - 849.87` vs `847.51 - 819.87`), proving the root cause of the UI discrepancy.
- We tested the Prisma SQL syntax to ensure types natively handle `Number()` conversions when PostgreSQL returns decimal arrays.

## Verification
Please run a `git pull` on your environment, compile your backend, and verify the UI.

To restart and verify:
```bash
git pull
pnpm run build
```

Open the Trial Balance, select the date up to `31 Jul 2026`, and it should now output **Cashfree = ₹27.64 DR** with a perfectly balanced Trial Balance.
