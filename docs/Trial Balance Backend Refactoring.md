# Trial Balance Backend Refactoring

The current Trial Balance relies on pulling raw Voucher Entries to the React frontend (with a hard 10,000 limit) and running a `.reduce()` over them. We will refactor this to use a Postgres SQL aggregate query, which eliminates the 10,000 entry bug, prevents any frontend pagination truncation issues, and handles large datasets optimally.

### Root Cause of the ₹21.64 vs ₹27.64 Bug (The Missing ₹6)
The UI DatePicker sends the date to the API. However, the React component was explicitly doing `nextDay.setDate(nextDay.getDate() + 1)` and sending that to the API. 
The backend `parseDateSafe` function natively sets any short date (like `2026-08-01`) to the end of the day (`23:59:59.999`).
Because the frontend added 1 full day, a Trial Balance run for **July 31st** was actually fetching data up to the end of **August 1st**.
On August 1st, there was ₹30 of Credit (a settlement) and ₹24 of Debit (a new purchase) in Cashfree, producing a net change of `-₹6`. 
`27.64 DR - 6.00 = 21.64 DR`. That is exactly where the discrepancy came from!

## Proposed Changes

### 1. Backend Service (`apps/stocks-service/src/accounting/accounting.service.ts`)
#### [MODIFY] `accounting.service.ts`
- Implement a new method `getTrialBalance(dateFrom?: string, dateTo?: string)`.
- The method will use `this.prisma.$queryRaw` with the aggregated SQL query provided.
- The SQL query will do a `LEFT JOIN` from `Ledger` to `VoucherEntry` to `Voucher`.
- We will group by Ledger fields and calculate `preDebit`, `preCredit`, `periodDebit`, and `periodCredit` using `CASE WHEN` sums.
- After fetching the raw rows, the backend will calculate the final `openingNet`, `closingNet`, `closingDr`, and `closingCr` for each ledger, and aggregate STOCK ledgers into `STOCK-AGG` as currently done on the frontend.
- Return a structured `TrialBalanceRow[]` array.

### 2. Backend Controller (`apps/stocks-service/src/accounting/accounting.controller.ts`)
#### [MODIFY] `accounting.controller.ts`
- Add `@Get('trial-balance')` endpoint mapping to `accountingService.getTrialBalance(...)`.

### 3. Frontend API Client (`apps/panels/lib/accounting-api.ts`)
#### [MODIFY] `accounting-api.ts`
- Add `fetchTrialBalance(dateFrom: string, dateTo: string)` function to call the new endpoint.

### 4. Frontend UI (`apps/panels/app/(accounting)/accounting/trial-balance/page.tsx`)
#### [MODIFY] `page.tsx`
- Replace the dual calls to `fetchLedgerEntries` with a single call to `fetchTrialBalance`.
- Delete the complex frontend `tbRows` useMemo calculation loop, as the backend will now return the finalized, balanced rows.
- The React component will only be responsible for:
  - Fetching the data.
  - Filtering by `searchQuery` and `showZeroBalances`.
  - Grouping the data based on Tally structures.
  - Displaying the final sums correctly using the un-filtered rows.

## Verification Plan

### Manual Verification
1. I will provide a scratch script (`prove-tb-bug.ts`) for you to run and verify the ₹6 Cashfree UI discrepancy first.
2. I will run the API locally and verify the SQL syntax matches Prisma's query engine correctly.
3. You can review the updated Trial Balance in your browser to verify it now matches the Accountant's target (Cashfree = ₹27.64 DR).
