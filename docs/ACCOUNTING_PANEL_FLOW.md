# 📘 Accounting Panel & Voucher System – Complete Reference Guide

> **For AI Agents & Developers**: Read this document before modifying ANY accounting, voucher, ledger, or financial reconciliation code.
> See also: [AGENTS.md rules](../.agents/AGENTS.md) and [ACCOUNTING_VOUCHER_ARCHITECTURE.md](./ACCOUNTING_VOUCHER_ARCHITECTURE.md).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Microservices](#2-architecture--microservices)
3. [Database Models (Prisma)](#3-database-models-prisma)
4. [Ledger System](#4-ledger-system)
5. [Voucher System](#5-voucher-system)
6. [Voucher Lifecycle & Approval Flow](#6-voucher-lifecycle--approval-flow)
7. [Voucher Numbering](#7-voucher-numbering)
8. [Side Effects on Approval](#8-side-effects-on-approval)
9. [Automated Voucher Generation (Webhooks)](#9-automated-voucher-generation-webhooks)
10. [Settlement Vouchers](#10-settlement-vouchers)
11. [Admin Panel UI Pages](#11-admin-panel-ui-pages)
12. [API Reference](#12-api-reference)
13. [User-Facing Transaction Integration](#13-user-facing-transaction-integration)
14. [Stock Ledger & Inventory](#14-stock-ledger--inventory)
15. [Accounting Period Locks](#15-accounting-period-locks)
16. [SunSystem Integration](#16-sunsystem-integration)
17. [Critical Rules & Constraints](#17-critical-rules--constraints)

---

## 1. System Overview

The accounting system is a **double-entry bookkeeping** system inspired by Tally ERP. It manages:

- **Ledgers** – Financial accounts (Bank, User, Stock, Purchase, Sale)
- **Vouchers** – Financial transactions with balanced debit/credit entries
- **Inventory** – Stock quantity tracking via voucher entries
- **Approval Workflow** – Maker-checker flow for manual vouchers
- **Automated Vouchers** – Auto-generated on payment webhooks and settlements

### High-Level Flow

```
User pays for stock → Cashfree Webhook → Receipt Voucher (auto-approved)
Admin approves order → Sales Voucher (auto-approved)
Admin buys stock from seller → Purchase Voucher (needs approval)
Admin issues refund → Credit Note / Debit Note (needs approval)
Cashfree settles to bank → Settlement Voucher (auto-approved)
```

---

## 2. Architecture & Microservices

### Backend Services

| Service | Location | Responsibility |
|:---|:---|:---|
| **stocks-service** | `apps/stocks-service/src/accounting/` | Core accounting engine – CRUD for ledgers, vouchers, groups, periods, settlements, reconciliation |
| **payments-service** | `apps/payments-service/src/payments/` | Cashfree webhook processing → auto-generates Receipt Vouchers |
| **payments-service** | `apps/payments-service/src/transactions/` | User-facing transaction list (orders + voucher entries) |

### Frontend Apps

| App | Location | Responsibility |
|:---|:---|:---|
| **panels** (Admin) | `apps/panels/app/(accounting)/accounting/` | Full accounting panel UI (Tally-like) |
| **web** (User) | `apps/web/app/(user)/dashboard/transactions/` | User-facing transaction list with voucher integration |

---

## 3. Database Models (Prisma)

Schema: `packages/db-unlistedstock/prisma/schema.prisma`

### Core Models

| Model | Lines | Purpose |
|:---|:---|:---|
| `Ledger` | L1115-1173 | Financial account (BANK, USER, STOCK, PURCHASE, SALE) |
| `Voucher` | L1182-1238 | Financial transaction with approval lifecycle |
| `VoucherEntry` | L1245-1276 | Debit/Credit line item of a voucher |
| `AccountingGroup` | L1378-1396 | Tally-style group classification for ledgers |
| `CustomVoucherType` | L1401-1414 | Custom sub-types with prefixes and approval settings |
| `AccountingPeriod` | L1419-1431 | Financial year period locks |
| `InventoryMovement` | L1449-1465 | Audit log of stock quantity changes |
| `SunAccount` | L1436-1444 | SunSystem ERP account mappings |

### Key Enums

```prisma
enum LedgerType {
  BANK       // Bank accounts (HDFC, Cashfree, etc.)
  USER       // User/Client ledger (1:1 with User model)
  STOCK      // Auto-created per Stock, tracks stock quantity
  PURCHASE   // System control account for purchase totals
  SALE       // System control account for sale totals
}

enum VoucherType {
  PAYMENT_SALES   // Sales voucher (stock delivery to client)
  RECEIPT         // Payment receipt (money received from client)
  JOURNAL         // General journal entry
  STOCK_JOURNAL   // Stock quantity adjustment (bonus, split, transfer)
  DEBIT_NOTE      // Debit note (adjustment to vendor/supplier)
  CREDIT_NOTE     // Credit note (refund/adjustment to client)
}

enum VoucherStatus {
  PENDING    // Created, awaiting approval
  APPROVED   // Approved — counts in books, side effects applied
  REMARKED   // Rejected with a mandatory note
}

enum EntryType {
  DEBIT   // Increases asset/expense, decreases liability/income
  CREDIT  // Decreases asset/expense, increases liability/income
}
```

---

## 4. Ledger System

### Ledger Types & Their Purpose

| Type | Name Pattern | Auto-Created? | Purpose |
|:---|:---|:---|:---|
| `BANK` | "HDFC Bank – 57500001892772", "CASHFREE PAYMENTS INDIA PVT LTD" | Seeded on startup | Company bank accounts and payment gateways |
| `USER` | User's full name (e.g., "Priyatam Saxena") | Auto on full KYC verification | 1:1 mapping with `User` model via `userId` |
| `STOCK` | Stock name (e.g., "NSE Limited") | Auto on stock creation | 1:1 mapping with `Stock` model via `stockId` |
| `PURCHASE` | "Purchase of Unlisted Share" | Seeded singleton | System control account for all purchase totals |
| `SALE` | "Sale of Unlisted Share" | Seeded singleton | System control account for all sale totals |

### Default System Ledgers (Seeded on Startup)

The `ensureAllDefaultLedgers()` method in `AccountingService` creates these on `onModuleInit()`:

1. **Sale of Unlisted Share** (type: SALE)
2. **Purchase of Unlisted Share** (type: PURCHASE)
3. **HDFC Bank – 57500001892772** (type: BANK)
4. **CASHFREE PAYMENTS INDIA PVT LTD** (type: BANK) — dedicated Cashfree gateway ledger

### Ledger Fields

```typescript
{
  id: string;              // CUID
  name: string;            // Display name
  code: string;            // Unique code (e.g., "UL0523A3F9KX2M")
  sunCode: string;         // SunSystem ERP code
  sunName: string;         // SunSystem ERP name
  type: LedgerType;
  userId?: string;         // Links to User (for USER type)
  stockId?: string;        // Links to Stock (for STOCK type)
  openingBalance: number;  // Balance at FY start
  openingBalanceType: "DR" | "CR";
  currentBalance: number;  // Running balance (updated on voucher posting)
  groupId?: string;        // Tally-style accounting group assignment
  isActive: boolean;       // Soft-delete flag
  // Bank-specific: bankName, accountNumber, ifscCode
  // User-specific: phone, email, pan, gstNo, dematAccountNo, etc.
}
```

### Ledger Balance Updates

When a voucher is APPROVED, each entry updates its ledger's `currentBalance`:
- **DEBIT** entry → `currentBalance += amount` (increases balance)
- **CREDIT** entry → `currentBalance -= amount` (decreases balance)

---

## 5. Voucher System

### Voucher Types & When They Are Used

| Voucher Type | Prefix | Trigger | Carries Stock Fields? |
|:---|:---|:---|:---|
| **Receipt** (`RECEIPT`) | `RCP-` | User pays via Cashfree | ❌ NEVER (narration only) |
| **Purchase** (`RECEIPT` + `voucherClass: PURCHASE`) | `PUR-` | Admin buys stock from seller | ✅ Yes (scriptName, isin, qty, rate) |
| **Sales** (`PAYMENT_SALES`) | `SAL-` | Order completed, shares delivered | ✅ Yes (scriptName, isin, qty, rate) |
| **Payment** (`PAYMENT_SALES` + `voucherClass: PAYMENT`) | `PAY-` | Admin pays money to user (refund) | ❌ No |
| **Journal** (`JOURNAL`) | `JV-` | Manual adjustments | Optional |
| **Stock Journal** (`STOCK_JOURNAL`) | `SJ-` | Bonus, split, transfer adjustments | ✅ Yes (qty, rate) |
| **Debit Note** (`DEBIT_NOTE`) | `DN-` | Stock return, adjustment | ✅ Yes |
| **Credit Note** (`CREDIT_NOTE`) | `CN-` | Refund, credit adjustment | ✅ Yes |

### Voucher Fields

```typescript
{
  id: string;
  voucherNumber: string;       // Auto-generated: "SAL-0001", "RCP-0042"
  type: VoucherType;
  date: DateTime;              // Transaction date
  status: VoucherStatus;       // PENDING → APPROVED or REMARKED
  narration?: string;          // Description / memo
  totalAmount: number;         // Sum of one side (debit = credit)
  referenceNumber?: string;    // UTR No, Contract Note No
  referenceDate?: DateTime;
  createdById: string;         // Admin who created ("SYSTEM" for auto)
  approvedById?: string;       // Admin who approved/remarked
  approvedAt?: DateTime;
  approvalRemark?: string;     // Required when REMARKED
  adjustmentType?: string;     // BONUS, SPLIT, TRANSFER_IN, etc.
  customTypeId?: string;       // Link to CustomVoucherType
  metadata?: JSON;             // Flexible: { autoGenerated, orderId, voucherClass, ... }
  entries: VoucherEntry[];     // 2+ balanced debit/credit entries
}
```

### VoucherEntry Fields

```typescript
{
  id: string;
  voucherId: string;     // Parent voucher
  ledgerId: string;      // Target ledger account
  entryType: EntryType;  // DEBIT or CREDIT
  amount: number;        // Always positive
  narration?: string;    // Line-level narration
  scriptName?: string;   // Stock name (for sale/purchase)
  isin?: string;         // ISIN code (for sale/purchase)
  qty?: number;          // Quantity of shares
  rate?: number;         // Rate per share
  remarks?: string;      // Extra remarks
  metadata?: JSON;       // Order ID, Mode of Payment, etc.
}
```

---

## 6. Voucher Lifecycle & Approval Flow

```
┌────────────────────────────────────────────────────┐
│           VOUCHER LIFECYCLE DIAGRAM                 │
├────────────────────────────────────────────────────┤
│                                                    │
│  Admin creates voucher                             │
│         │                                          │
│         ▼                                          │
│  ┌─────────────┐                                   │
│  │   PENDING    │◀──── Admin edits REMARKED voucher │
│  └──────┬──────┘                                   │
│         │                                          │
│    ┌────┴────┐                                     │
│    ▼         ▼                                     │
│ ┌────────┐ ┌──────────┐                            │
│ │APPROVED│ │ REMARKED │                             │
│ └───┬────┘ └──────────┘                            │
│     │         (rejected with note,                 │
│     │          can be edited → re-submitted)       │
│     ▼                                              │
│  Side Effects Applied:                             │
│  • Ledger balances updated                         │
│  • Stock quantities updated                        │
│  • InventoryMovement logs created                  │
│  • Orders/Portfolio synced (for user vouchers)     │
│  • Redis cache invalidated                         │
│                                                    │
│  ┌──────────────────┐                              │
│  │ REVERSE (optional)│                             │
│  │ Creates mirror    │                             │
│  │ voucher with      │                             │
│  │ swapped D/C       │                             │
│  │ (auto-APPROVED)   │                             │
│  └──────────────────┘                              │
└────────────────────────────────────────────────────┘
```

### Auto-Approval Rules

Vouchers are auto-approved (bypass PENDING) when:
1. `createdById === 'SYSTEM'` (auto-generated by webhooks)
2. `createdById === 'AUTO_SETTLEMENT_SYSTEM'` (auto settlement vouchers)
3. `metadata.autoGenerated === true`
4. `CustomVoucherType.needsApproval === false`

All other manually-created vouchers start as **PENDING** and require admin approval.

### Approval Requirements

- Requires `approve_vouchers` permission or Super Admin role
- Cannot approve a non-PENDING voucher
- Validates voucher date against accounting period locks

### Remark (Rejection)

- Sets status to `REMARKED` with a mandatory remark note
- Admin can then edit the voucher → it resets to `PENDING`

### Reversal

- Only APPROVED vouchers can be reversed
- Creates a **new mirror voucher** with swapped DEBIT↔CREDIT entries
- The reversal voucher is auto-APPROVED
- Carries `metadata: { isReversal: true, reversedVoucherId: "..." }`
- The original voucher's metadata is updated with `reversedById`

---

## 7. Voucher Numbering

Auto-generated in `generateVoucherNumber()`:

| Voucher Type | Default Prefix | Override Conditions |
|:---|:---|:---|
| `PAYMENT_SALES` | `SAL-` | → `PAY-` if `metadata.voucherClass === 'PAYMENT'` |
| `RECEIPT` | `RCP-` | → `PUR-` if `metadata.voucherClass === 'PURCHASE'` |
| `JOURNAL` | `JV-` | — |
| `STOCK_JOURNAL` | `SJ-` | — |
| `DEBIT_NOTE` | `DN-` | — |
| `CREDIT_NOTE` | `CN-` | — |
| Custom types | Custom prefix | From `CustomVoucherType.prefix` |

Format: `PREFIX-XXXX` (zero-padded 4 digits, e.g., `SAL-0042`, `RCP-0001`)

---

## 8. Side Effects on Approval

When a voucher transitions to APPROVED (`postApprovedVoucherSideEffects()`):

### 1. Stock Quantity Updates

For Purchase, Sale, Debit Note, Credit Note, and Stock Journal vouchers:
- **DEBIT** entry with qty → Increases stock quantity (stock bought/received)
- **CREDIT** entry with qty → Decreases stock quantity (stock sold/dispatched)
- Validates that stock quantity never goes below zero
- Creates `InventoryMovement` audit log entries

### 2. Ledger Balance Updates

For ALL voucher types:
- DEBIT entry → `ledger.currentBalance += amount`
- CREDIT entry → `ledger.currentBalance -= amount`

### 3. User Order & Portfolio Sync

When a voucher involves a USER-type ledger (`entry.ledger.type === 'USER'` && `entry.ledger.userId` exists):

**For Sales Vouchers (stock leaving to client):**
- Creates/updates a matching `Order` record for the user (status: COMPLETED, payment: PAID)
- Updates user's `Portfolio` holdings (quantity increases on sale TO user)
- On reversal: cancels the order, reduces portfolio

**For Receipt Vouchers (payment from client):**
- Creates a matching `Order` record (status: PAID, payment: PAID)
- On reversal: cancels the order

### 4. Cache Invalidation

- Clears `stocks:all:active` Redis cache when stock vouchers are approved

---

## 9. Automated Voucher Generation (Webhooks)

### Cashfree Payment Webhook Flow

```
User clicks "Pay" → Cashfree processes → Webhook → payments-service
                                                          │
                                                          ▼
                                                  processWebhookPayload()
                                                          │
                                                          ▼
                                                  generateVouchers(order)
                                                          │
                                                  ┌───────┴──────────┐
                                                  │ Receipt Voucher  │
                                                  │ (RCP-XXXX)       │
                                                  │                  │
                                                  │ DEBIT: Cashfree  │
                                                  │ CREDIT: User     │
                                                  │ Status: APPROVED │
                                                  │ metadata: {      │
                                                  │  autoGenerated,  │
                                                  │  orderId         │
                                                  │ }                │
                                                  └──────────────────┘
```

> ⚠️ **CRITICAL**: The debit ledger must ALWAYS be `CASHFREE PAYMENTS INDIA PVT LTD`, NEVER `HDFC Bank`. Use `getCashfreeLedger()` to resolve it.

### Order Completion Flow

```
Admin marks order COMPLETED → stocks-service → orders.service.ts
                                                      │
                                                      ▼
                                              generateSalesVoucher(order)
                                                      │
                                              ┌───────┴──────────┐
                                              │ Sales Voucher    │
                                              │ (SAL-XXXX)       │
                                              │                  │
                                              │ DEBIT: User      │
                                              │ CREDIT: Sale A/C │
                                              │ + Stock entry     │
                                              │ with isin, qty,  │
                                              │ rate, scriptName │
                                              │ Status: APPROVED │
                                              └──────────────────┘
```

---

## 10. Settlement Vouchers

When Cashfree settles batches into the company bank account:

```
Cashfree Settlement → API → accounting.service.ts
                                    │
                                    ▼
                        createSettlementVouchers()
                                    │
                            ┌───────┴──────────┐
                            │ Settlement RCP   │
                            │                  │
                            │ DEBIT: HDFC Bank │
                            │ CREDIT: Cashfree │
                            │ metadata: {      │
                            │  voucherClass:   │
                            │  BANK_SETTLEMENT │
                            │  settlementId    │
                            │ }                │
                            └──────────────────┘
```

The `autoCreatePendingSettlementVouchers()` runs on startup to catch any missed settlements.

---

## 11. Admin Panel UI Pages

Location: `apps/panels/app/(accounting)/accounting/`

| Page | Route | Purpose |
|:---|:---|:---|
| **Dashboard** | `/accounting/dashboard` | Stats overview, pending approvals count |
| **Day Book** | `/accounting/day-book` | Chronological list of all posted transactions (15-column ledger format) |
| **Vouchers** | `/accounting/vouchers` | List all vouchers with filters (type, status, date, search) |
| **Voucher Entry** | `/accounting/voucher-entry` | Single voucher detail view with entries |
| **Chart of Accounts** | `/accounting/chart-of-accounts` | All ledgers organized by groups |
| **Chart of Stocks** | `/accounting/chart-of-stocks` | Stock inventory ledgers with quantities |
| **Contact Master** | `/accounting/contact-master` | User/party ledger directory |
| **Trial Balance** | `/accounting/trial-balance` | Trial balance report |
| **Bank Settlements** | `/accounting/bank-settlements` | Cashfree settlement tracking and reconciliation |
| **Cashfree Reconciliation** | `/accounting/cashfree-reconciliation` | Cashfree gateway balance reconciliation |
| **Invoices** | `/accounting/invoices` | Invoice generation and listing |
| **Master Settings** | `/accounting/master-settings` | Accounting groups, custom voucher types, period locks |
| **SunSystem Transfer** | `/accounting/sunsystem-transfer` | Export vouchers to SunSystem ERP |

### Popup Modals

| Popup | Route | Purpose |
|:---|:---|:---|
| **Create Ledger** | `/accounting/popup/create-ledger` | Create new BANK/USER/STOCK ledger |
| **Alter Ledger** | `/accounting/popup/alter-ledger` | Edit existing ledger |
| **Suspend Ledger** | `/accounting/popup/suspend-ledger` | Deactivate a ledger |
| **Create Voucher** | `/accounting/popup/create-voucher` | Create new voucher with entries |

---

## 12. API Reference

Base URL: `/api/accounting` (guarded by `AccountingJwtAuthGuard`)

### Dashboard
| Method | Endpoint | Description |
|:---|:---|:---|
| GET | `/stats` | Dashboard statistics |
| GET | `/ledger-entries` | 15-column ledger format entries |

### Ledgers
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/ledgers` | Create a new ledger |
| GET | `/ledgers` | List all ledgers (filters: type, search, activeOnly) |
| GET | `/ledgers/:id` | Get ledger by ID with recent entries |
| PATCH | `/ledgers/:id` | Update a ledger |
| DELETE | `/ledgers/:id` | Soft-delete (deactivate) a ledger |
| GET | `/purchase-ledger` | Get/create singleton Purchase control ledger |
| GET | `/sale-ledger` | Get/create singleton Sale control ledger |
| GET | `/bank-ledger` | Get/create singleton Bank control ledger |
| POST | `/ensure-defaults` | Seed all default system ledgers (idempotent) |

### Groups
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/groups` | Create accounting group |
| GET | `/groups` | List all accounting groups |

### Vouchers
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/vouchers` | Create new voucher with entries |
| GET | `/vouchers` | List vouchers (filters: type, status, date, search, customTypeId) |
| GET | `/vouchers/:id` | Get voucher by ID with entries |
| PATCH | `/vouchers/:id` | Edit PENDING/REMARKED voucher |
| PATCH | `/vouchers/:id/approve` | Approve PENDING voucher ⚡ Requires `approve_vouchers` permission |
| PATCH | `/vouchers/:id/remark` | Reject with note ⚡ Requires `approve_vouchers` permission |
| POST | `/vouchers/:id/reverse` | Reverse an APPROVED voucher |
| PATCH | `/entries/:id` | Amend a single voucher entry |

### Custom Voucher Types
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/voucher-types` | Create custom type (e.g., "GST Sales") |
| GET | `/voucher-types` | List all custom types |
| PATCH | `/voucher-types/:id` | Update custom type |

### Balance Operations
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/recalculate-balances` | Recompute ALL ledger balances from entries |

### Accounting Periods
| Method | Endpoint | Description |
|:---|:---|:---|
| GET | `/accounting-periods` | List all periods |
| POST | `/accounting-periods` | Create new period |
| PATCH | `/accounting-periods/:id` | Update period (lock dates) |
| POST | `/accounting-periods/:id/rollover` | Rollover to next FY |
| DELETE | `/accounting-periods/:id` | Delete period |

### Settlements
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/settlements/create-vouchers` | Create settlement vouchers |
| POST | `/settlements/voucher-status` | Check settlement voucher status |
| POST | `/settlements/auto-create` | Trigger auto-creation of pending settlement vouchers |
| POST | `/settlements/sync-utrs` | Bulk sync UTR numbers from Cashfree CSV |

### SunSystem Integration
| Method | Endpoint | Description |
|:---|:---|:---|
| GET | `/sun-accounts` | List SunSystem account mappings |
| POST | `/sun-accounts` | Create SunSystem account mapping |
| GET | `/sunsystem/vouchers` | Get vouchers for SunSystem export |
| POST | `/sunsystem/batch` | Create batch for SunSystem upload |
| POST | `/sunsystem/mark-uploaded` | Mark batch as uploaded |
| POST | `/sunsystem/clear-batch` | Clear a batch |

---

## 13. User-Facing Transaction Integration

### How Users See Voucher Transactions

The user's **Transactions** page (`apps/web/app/(user)/dashboard/transactions/page.tsx`) shows BOTH:

1. **Order-based transactions** — from `Order` table (stock purchases, payments)
2. **Voucher-based transactions** — from `VoucherEntry` table (refunds, manual payments, adjustments)

### Backend Flow

```
GET /payments/transactions (JwtAuthGuard)
         │
         ▼
TransactionsService.findAll(userId)
         │
    ┌────┴────────────────────────────┐
    │                                 │
    ▼                                 ▼
prisma.order.findMany()     prisma.ledger.findFirst()
    │                         (type: USER, userId)
    │                                 │
    │                                 ▼
    │                     prisma.voucherEntry.findMany()
    │                       (ledgerId, voucher.status = APPROVED)
    │                                 │
    ▼                                 ▼
{ orders }                    { voucherTransactions }
    │                                 │
    └────────┬────────────────────────┘
             ▼
    Return combined response
```

### Frontend Tabs

| Tab | Shows |
|:---|:---|
| **All Transactions** | Both orders and voucher entries, sorted by date |
| **Investments** | Only order-based buy transactions (COMPLETED/PAID) |
| **Payments Received** | Only voucher entries where user's ledger was CREDITED |

### VoucherTransaction Shape (Frontend)

```typescript
interface VoucherTransaction {
  id: string;
  source: 'voucher';
  voucherId: string;
  voucherNumber: string;     // e.g., "CN-0003"
  voucherType: string;       // CREDIT_NOTE, PAYMENT_SALES, etc.
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  narration: string;
  referenceNumber?: string;
  scriptName?: string;
  isin?: string;
  qty?: number;
  rate?: number;
  date: string;
  createdAt: string;
}
```

---

## 14. Stock Ledger & Inventory

### Stock Quantity Tracking

Each `Stock` has a `stockQuantity` field that is automatically updated when:
- **Purchase Voucher approved** → `stockQuantity += qty` (DEBIT leg)
- **Sales Voucher approved** → `stockQuantity -= qty` (CREDIT leg)
- **Stock Journal approved** → +/- based on entry type
- **Debit/Credit Note approved** → +/- based on entry type

### Stock Ledger Page

The Stock Ledger page (`stock-ledger/[isin]/page.tsx`) shows per-stock transaction history:
- **MUST IGNORE** all `RECEIPT` / `RCP-` vouchers (they are financial-only)
- Shows only `PUR-`, `SAL-`, `DN-`, `CN-`, `SJ-` vouchers

### InventoryMovement

Each stock quantity change creates an `InventoryMovement` audit record:
```typescript
{
  stockId: string;
  voucherId: string;
  qty: number;
  rate: number;
  type: "PURCHASE" | "SALE" | "BONUS" | "SPLIT" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DEBIT_NOTE" | "CREDIT_NOTE";
  snapshotDate?: DateTime;
  createdById: string;
}
```

---

## 15. Accounting Period Locks

Accounting periods define financial year boundaries and lock date ranges:

```typescript
{
  name: "FY 2025-26";
  startDate: "2025-04-01";
  endDate: "2026-03-31";
  lockStartDate?: DateTime;  // Optional: lock vouchers before this date
  lockEndDate?: DateTime;    // Optional: lock vouchers after this date
  isActive: boolean;
}
```

When a lock is active, `validateVoucherDate()` prevents creating/approving/reversing vouchers dated within the locked range.

**Rollover**: Creates the next FY period and carries forward closing balances as opening balances.

---

## 16. SunSystem Integration

The system can export vouchers to SunSystem ERP:

1. **SunAccount mappings** — Map internal ledger codes to SunSystem account codes
2. **Batch creation** — Group vouchers into batches for export
3. **Upload tracking** — Mark batches as uploaded to SunSystem
4. **Ledger Sun codes** — Each ledger has optional `sunCode` and `sunName` fields

---

## 17. Critical Rules & Constraints

### Double-Entry Rule
- Every voucher MUST have `∑ DEBIT amounts === ∑ CREDIT amounts`
- Minimum 2 entries per voucher
- Total amount must be > 0 (except Stock Journals)

### Receipt Voucher Rules (AGENTS.md §1)
- ❌ NEVER put `qty`, `rate`, `isin`, `scriptName` on `RCP-` voucher entries
- ✅ Stock references go in `narration` or `voucher.metadata` only
- The `cleanReceiptVoucherStockFields()` startup task enforces this

### Cashfree Ledger Rule (AGENTS.md §5)
- Order Payment Receipts: DEBIT `CASHFREE PAYMENTS INDIA PVT LTD`, CREDIT `User Ledger`
- Bank Settlements: DEBIT `HDFC Bank`, CREDIT `CASHFREE PAYMENTS INDIA PVT LTD`
- ❌ NEVER use `prisma.ledger.findFirst({ where: { type: 'BANK' } })` for order receipts
- ✅ ALWAYS call `getCashfreeLedger()`

### Approved Voucher Immutability
- APPROVED vouchers cannot be edited — they must be **reversed** instead
- Reversal creates a new voucher with swapped DEBIT/CREDIT entries
- Both the original and reversal vouchers remain in the books (audit trail)

### Stock Quantity Guard
- Stock quantity can NEVER go below zero
- `validateStockQuantities()` checks before approval
- Throws `BadRequestException` if insufficient stock

### Ledger Deletion Guard
- Ledgers with voucher entries cannot be deleted
- They can only be soft-deleted (deactivated) via `isActive = false`

---

## Quick Reference: Common Scenarios

### Scenario 1: User Buys Stock (Normal Flow)
1. User pays via Cashfree → **Receipt Voucher** (RCP-XXXX) auto-created & auto-approved
2. Admin confirms share delivery → **Sales Voucher** (SAL-XXXX) auto-created & auto-approved
3. User's portfolio updated, stock quantity decreased

### Scenario 2: Admin Issues Refund
1. Admin creates **Credit Note** (CN-XXXX) in accounting panel
2. Entries: DEBIT `Some Account`, CREDIT `User Ledger`
3. Voucher goes to PENDING → Super Admin approves
4. User sees refund in "Payments Received" tab of Transactions page

### Scenario 3: Admin Buys Stock from Seller
1. Admin creates **Purchase Voucher** (PUR-XXXX) in accounting panel
2. Entries include stock details (isin, qty, rate, scriptName)
3. Voucher goes to PENDING → Super Admin approves
4. Stock quantity increases, inventory movement logged

### Scenario 4: Admin Pays User for Stock Buyback
1. Admin creates **Payment Voucher** (PAY-XXXX, type: PAYMENT_SALES + metadata.voucherClass: PAYMENT)
2. Entries: DEBIT `User Ledger`, CREDIT `HDFC Bank`
3. PENDING → Approved
4. User sees payment in Transactions page

### Scenario 5: Correcting a Mistake
1. Admin navigates to the voucher and clicks **Reverse**
2. System creates a mirror voucher with swapped entries (auto-APPROVED)
3. Both original and reversal remain in books for audit
4. All side effects (stock qty, portfolio, orders) are undone

### Scenario 6: User Sells Shares to Company (Two-Voucher Flow)

When a user sells their shares to your company, the company is **purchasing inventory from the user**. This is a two-step process:

**Example**: User sells 100 NSDL shares at ₹500/share = ₹50,000

```
USER
  │
  │ 100 NSDL shares
  ▼
YOUR COMPANY
  │
  ├── NSDL Stock Ledger
  │      +100 shares / ₹50,000
  │
  ├── User Ledger
  │      Payable ₹50,000
  │
  └── HDFC Bank
         -₹50,000
```

**Step 1: Purchase Voucher (PUR-XXXX)** — Stock comes into company inventory

```
┌─────────────────────────────────────────────┐
│ Purchase Voucher: PUR-0042                  │
│ Stock: NSDL | Qty: 100 | Rate: ₹500        │
├──────────────────────┬──────────────────────┤
│ DEBIT                │ CREDIT               │
│ NSDL Stock Ledger    │ User Ledger          │
│ ₹50,000              │ ₹50,000              │
│ (qty: 100, rate: 500)│                      │
└──────────────────────┴──────────────────────┘
Effect:
  • NSDL stockQuantity += 100
  • User Ledger balance: -₹50,000 (payable to user)
  • InventoryMovement log created (type: PURCHASE)
```

**Step 2: Payment Voucher (PAY-XXXX)** — Company pays the user from bank

```
┌─────────────────────────────────────────────┐
│ Payment Voucher: PAY-0015                   │
├──────────────────────┬──────────────────────┤
│ DEBIT                │ CREDIT               │
│ User Ledger          │ HDFC Bank            │
│ ₹50,000              │ ₹50,000              │
└──────────────────────┴──────────────────────┘
Effect:
  • User Ledger balance: ₹0 (payable settled)
  • HDFC Bank balance: -₹50,000 (cash left bank)
  • User sees payment in "Payments Received" tab
```

**How to create in the Accounting Panel:**

1. Create a **Purchase Voucher** (type: `RECEIPT`, metadata: `{ voucherClass: 'PURCHASE' }`):
   - DEBIT: Select the stock's ledger (e.g., "NSE Limited") with qty, rate, ISIN
   - CREDIT: Select the user's ledger
   - Goes to PENDING → Super Admin approves → Stock qty increases

2. Create a **Payment Voucher** (type: `PAYMENT_SALES`, metadata: `{ voucherClass: 'PAYMENT' }`):
   - DEBIT: User Ledger (settles the payable)
   - CREDIT: HDFC Bank (cash leaves the bank)
   - Goes to PENDING → Super Admin approves → User sees payment in Transactions
