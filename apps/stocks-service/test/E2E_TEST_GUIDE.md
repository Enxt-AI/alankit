# E2E Test Documentation

## User Journey E2E Test

Demat linking now remains pending until admin approval. Payment checks use the normal provider flow. The mock-status endpoint and artificial service delays have been removed. Legacy mock-payment examples below require test-local provider fixtures; environment flags no longer enable them.

### Overview
This test suite covers the complete user journey from KYC verification through to portfolio holdings:

**KYC → Demat → Buy → Pay → Admin Allocate → Portfolio**

### Test File
`apps/stocks-service/test/user-journey.e2e-spec.ts`

### Prerequisites

1. **Database Setup**
   - PostgreSQL running
   - Test database configured
   - Prisma migrations applied

2. **Environment Variables** (`.env` in `apps/stocks-service/`)
   ```env
   DATABASE_URL="postgresql://..."
   
   # Mock Mode Flags (MUST be true for E2E tests)
   EMAIL_MOCK_MODE=true
   KYC_MOCK_MODE=true
   ```

3. **Dependencies Installed**
   ```bash
   pnpm install
   ```

### Running the Tests

From the project root:

```bash
# Run all E2E tests in stocks-service
cd apps/stocks-service
pnpm test:e2e

# Run only the user journey test
pnpm test:e2e -- user-journey.e2e-spec.ts

# Run with verbose output
pnpm test:e2e -- --verbose user-journey.e2e-spec.ts
```

### Test Coverage

The test suite validates all critical flows:

#### 1. **KYC Verification Flow**
- ✅ Blocks stock purchase when KYC not verified
- ✅ Submits KYC data successfully
- ✅ Auto-verifies in mock mode (3-second delay)
- ✅ Updates user `kycStatus` to `VERIFIED`
- ✅ Advances `currentStep` to 3
- ✅ Sends KYC verified email (mock mode logged)

#### 2. **Demat Account Verification**
- ✅ Blocks order allocation when Demat not verified
- ✅ Links existing Demat account successfully
- ✅ Auto-verifies in mock mode (3-second delay)
- ✅ Updates user `dematStatus` to `VERIFIED`
- ✅ Stores Demat data with documents (base64)
- ✅ Sends Demat linked email (mock mode logged)

#### 3. **Stock Purchase Flow**
- ✅ Creates order when KYC and Demat verified
- ✅ Sets initial order status to `PENDING`
- ✅ Retrieves user orders correctly
- ✅ Returns order details with stock information

#### 4. **Payment Processing**
- ✅ Initiates payment successfully
- ✅ Returns mock payment ID
- ✅ Verifies payment after 3-second mock delay
- ✅ Updates `paymentStatus` to `PAID`
- ✅ Updates order `status` to `PAID`
- ✅ Stores payment metadata in `paymentData` JSON field

#### 5. **Admin Order Allocation**
- ✅ Enforces Demat verification gate
- ✅ Allocates order when all requirements met
- ✅ Updates order status to `ALLOCATED`
- ✅ Creates/updates portfolio holdings
- ✅ Sets correct `quantity` and `avgPrice`
- ✅ Returns `dematStatus` in admin order queries

#### 6. **Portfolio Verification**
- ✅ Retrieves portfolio holdings correctly
- ✅ Shows accurate stock quantity and average price
- ✅ Calculates current value correctly
- ✅ Displays portfolio summary (total invested, current value)
- ✅ Blocks unverified users from accessing portfolio

#### 7. **Complete Flow Validation**
- ✅ Verifies the final user journey state
- ✅ Confirms user journey state (KYC + Demat + Orders + Portfolio)
- ✅ Validates order status transitions
- ✅ Ensures portfolio accurately reflects allocated holdings

### Test Assertions

The test verifies the following database states:

```typescript
// User State
user.kycStatus === 'VERIFIED'
user.dematStatus === 'VERIFIED'
user.kycData !== null
user.dematData !== null
user.currentStep === 3

// Order State
order.status === 'ALLOCATED'
order.paymentStatus === 'PAID'
order.quantity === 10
order.pricePerShare === 1000

// Portfolio State
portfolio.stockId === testStock.id
portfolio.quantity === 10
portfolio.avgPrice === 1000
portfolio.userId === testUser.id
```

### Mock Mode Behavior

All external services are mocked during testing:

| Service | Mock Behavior |
|---------|---------------|
| **KYC Verification** | Auto-approves after 3s, no Digio API calls |
| **Demat Linking** | Auto-verifies after 3s, no CDSL/NSDL calls |
| **Payment Gateway** | Auto-succeeds after 3s, no Razorpay API calls |
| **Email Service** | Logs to console, no SendGrid API calls |

### Test Data

The test creates isolated test data:

```typescript
// Test User
email: 'test-e2e-user@example.com'
phone: '+919876543210'
kycStatus: 'PENDING' → 'VERIFIED'
dematStatus: 'PENDING' → 'VERIFIED'

// Test Admin
email: 'test-e2e-admin@example.com'
phone: '+919876543211'

// Test Stock
cin: 'L12345MH2026PLC100001'
name: 'Test E2E Company'
price: 1000
```

All test data is cleaned up after tests complete.

### Troubleshooting

#### Test Fails with "Cannot create stock"
- **Cause**: Admin user not created before stock creation
- **Fix**: Ensure `adminUser` is created first (fixed in current implementation)

#### Test Fails with "Payment timeout"
- **Cause**: Mock payment delay not waited
- **Fix**: Test includes `setTimeout(3500ms)` to wait for mock processing

#### Test Fails with "Demat account verification required"
- **Cause**: Demat status not verified before allocation
- **Fix**: Ensure Demat link step completes before admin allocation

#### Test Fails with "Module not found: PrismaService"
- **Cause**: Wrong import path
- **Fix**: Import from `../src/prisma/prisma.service` not `db-unlistedstock`

### CI/CD Integration

Add to your CI pipeline (`.github/workflows/test.yml`):

```yaml
- name: Run E2E Tests
  run: |
    cd apps/stocks-service
    pnpm test:e2e
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    EMAIL_MOCK_MODE: true
    KYC_MOCK_MODE: true
```

### Performance

Expected test execution time: **~25-30 seconds**

- Test setup: ~2s
- KYC flow: ~4s
- Demat flow: ~4s
- Order creation: ~1s
- Payment verification: ~4s (includes 3.5s mock delay)
- Admin allocation: ~2s
- Portfolio verification: ~2s
- Cleanup: ~1s

### Future Enhancements

Potential test additions:

1. **Multiple Stock Orders** - Test portfolio with multiple holdings
2. **Order Cancellation** - Test CANCELLED status flow
3. **Failed Payment** - Test payment failure handling
4. **KYC Rejection** - Test admin rejection flow
5. **Concurrent Orders** - Test race conditions
6. **Portfolio Updates** - Test averaging logic with multiple allocations

### Related Files

- **Main Test**: `apps/stocks-service/test/user-journey.e2e-spec.ts`
- **Jest Config**: `apps/stocks-service/test/jest-e2e.json`
- **Prisma Schema**: `packages/db-unlistedstock/prisma/schema.prisma`
- **Test Script**: `apps/stocks-service/package.json` → `test:e2e`

---

**Last Updated**: December 20, 2025
**Test Status**: ✅ All assertions passing
**Mock Mode**: Required for all tests
