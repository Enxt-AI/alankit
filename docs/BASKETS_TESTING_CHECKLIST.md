# Stock Baskets Testing Checklist

## Pre-Testing Setup

### 1. Database Migration
```bash
cd packages/db-unlistedstock
pnpm prisma migrate deploy
```

### 2. Verify Admin Permission
```sql
-- Check if admin has cms_baskets permission
SELECT id, name, email, permissions 
FROM "Admin" 
WHERE 'cms_baskets' = ANY(permissions);

-- Add permission if needed
UPDATE "Admin" 
SET permissions = array_append(permissions, 'cms_baskets') 
WHERE email = 'your-admin@example.com';
```

### 3. Prepare Test Data
```sql
-- Ensure you have active stocks for testing
SELECT id, name, symbol, price, "isActive" 
FROM "Stock" 
WHERE "isActive" = true 
LIMIT 5;
```

### 4. Start Services
```bash
# Terminal 1: Start auth-service
cd apps/auth-service
pnpm dev

# Terminal 2: Start stocks-service
cd apps/stocks-service
pnpm dev

# Terminal 3: Start Redis (if not running)
docker-compose up -d redis

# Terminal 4: Start PostgreSQL (if not running)
docker-compose up -d postgres
```

---

## API Testing with cURL/Postman

### Step 1: Login to CMS
```bash
POST http://localhost:3000/auth/cms/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}

# Save the JWT token from response
```

### Step 2: Create a Test Basket
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Test High Growth Basket",
  "description": "A curated collection of high-growth stocks for testing",
  "tagline": "Invest in tomorrow's leaders",
  "category": "High Growth",
  "iconUrl": "https://example.com/icon.png",
  "status": "DRAFT",
  "subscriptionStartDate": "2024-01-01T00:00:00.000Z",
  "subscriptionEndDate": "2024-12-31T23:59:59.999Z",
  "minInvestment": 10000,
  "priceEffectiveDate": "2024-01-01T00:00:00.000Z",
  "isActive": false,
  "constituents": [
    {
      "stockId": "<stock-id-1>",
      "weight": 40
    },
    {
      "stockId": "<stock-id-2>",
      "weight": 35
    },
    {
      "stockId": "<stock-id-3>",
      "weight": 25
    }
  ]
}

# Expected: 201 Created with basket object
# Save the basket ID from response
```

### Step 3: Verify Creation
```bash
GET http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>

# Expected: Array with your created basket
```

### Step 4: Update the Basket
```bash
PUT http://localhost:3001/baskets/cms/<basket-id>
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "status": "OPEN",
  "isActive": true
}

# Expected: 200 OK with updated basket
```

### Step 5: Test Public Endpoint (No Auth)
```bash
GET http://localhost:3001/baskets/public

# Expected: Array with only active baskets
# Should include the basket you just activated
```

### Step 6: Test Public Single Basket
```bash
GET http://localhost:3001/baskets/public/<basket-id>

# Expected: Single basket with calculated currentPrice
# Should show resolvedStatus based on dates
```

### Step 7: Check Version History
```bash
GET http://localhost:3001/baskets/cms/<basket-id>/versions
Authorization: Bearer <your-jwt-token>

# Expected: Array of versions (CREATED, UPDATED)
# Should have at least 2 versions
```

### Step 8: Test Soft Delete
```bash
DELETE http://localhost:3001/baskets/cms/<basket-id>
Authorization: Bearer <your-jwt-token>

# Expected: 200 OK with isActive: false
```

### Step 9: Verify Deletion
```bash
GET http://localhost:3001/baskets/public

# Expected: Deleted basket should NOT appear in public list

GET http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>

# Expected: Deleted basket SHOULD appear with isActive: false
```

---

## Validation Testing

### Test Case 1: Weight Sum Validation
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Invalid Basket",
  "category": "Test",
  "minInvestment": 5000,
  "constituents": [
    { "stockId": "<stock-id>", "weight": 40 },
    { "stockId": "<stock-id>", "weight": 40 }
  ]
}

# Expected: 400 Bad Request
# Error: Weights must sum to 100 (got 80)
```

### Test Case 2: Invalid Weight Range
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Invalid Weight Basket",
  "category": "Test",
  "minInvestment": 5000,
  "constituents": [
    { "stockId": "<stock-id>", "weight": 150 }
  ]
}

# Expected: 400 Bad Request
# Error: Weight must be between 0 and 100
```

### Test Case 3: Missing Required Fields
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "description": "Missing name and category"
}

# Expected: 400 Bad Request
# Error: name is required, category is required, etc.
```

### Test Case 4: Empty Constituents Array
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Empty Basket",
  "category": "Test",
  "minInvestment": 5000,
  "constituents": []
}

# Expected: 400 Bad Request
# Error: constituents must contain at least 1 item
```

### Test Case 5: Invalid URL Format
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Invalid URL Basket",
  "category": "Test",
  "minInvestment": 5000,
  "iconUrl": "not-a-valid-url",
  "constituents": [
    { "stockId": "<stock-id>", "weight": 100 }
  ]
}

# Expected: 400 Bad Request
# Error: iconUrl must be a valid URL
```

---

## Authorization Testing

### Test Case 6: Missing JWT Token
```bash
GET http://localhost:3001/baskets/cms

# Expected: 401 Unauthorized
```

### Test Case 7: Invalid JWT Token
```bash
GET http://localhost:3001/baskets/cms
Authorization: Bearer invalid-token-here

# Expected: 401 Unauthorized
```

### Test Case 8: Missing cms_baskets Permission
```sql
-- Remove permission temporarily
UPDATE "Admin" 
SET permissions = array_remove(permissions, 'cms_baskets') 
WHERE email = 'test-admin@example.com';
```

```bash
GET http://localhost:3001/baskets/cms
Authorization: Bearer <jwt-token-of-user-without-permission>

# Expected: 403 Forbidden
```

---

## Cache Testing

### Test Case 9: Verify Cache TTL
```bash
# 1. Call public endpoint
GET http://localhost:3001/baskets/public

# 2. Check Redis for cached value
redis-cli
> GET baskets:active
> TTL baskets:active
# Should be ~300 seconds (5 minutes)

# 3. Wait 5+ minutes and call again
GET http://localhost:3001/baskets/public

# Cache should be regenerated
```

### Test Case 10: Verify Cache Invalidation
```bash
# 1. Call public endpoint (creates cache)
GET http://localhost:3001/baskets/public

# 2. Update any basket
PUT http://localhost:3001/baskets/cms/<basket-id>
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
{ "name": "Updated Name" }

# 3. Check Redis - cache should be cleared
redis-cli
> GET baskets:active
# Should return (nil)

# 4. Call public endpoint again
GET http://localhost:3001/baskets/public

# New cache should be created with updated data
```

---

## Price Calculation Testing

### Test Case 11: Verify Price Calculation
```sql
-- Get stock prices
SELECT id, name, price FROM "Stock" WHERE id IN ('<id1>', '<id2>', '<id3>');
```

Create a basket with known weights and manually calculate:
- Stock 1: ₹5000 × 40% = ₹2000
- Stock 2: ₹3000 × 35% = ₹1050
- Stock 3: ₹2000 × 25% = ₹500
- **Expected Total: ₹3550**

```bash
GET http://localhost:3001/baskets/public/<basket-id>

# Verify currentPrice matches manual calculation
```

---

## Status Resolution Testing

### Test Case 12: COMING_SOON Status
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Future Basket",
  "category": "Test",
  "status": "OPEN",
  "subscriptionStartDate": "2025-06-01T00:00:00.000Z",
  "subscriptionEndDate": "2025-12-31T23:59:59.999Z",
  "minInvestment": 5000,
  "isActive": true,
  "constituents": [...]
}

GET http://localhost:3001/baskets/public/<basket-id>

# Expected: resolvedStatus = "COMING_SOON"
```

### Test Case 13: CLOSED Status (Past End Date)
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Past Basket",
  "category": "Test",
  "status": "OPEN",
  "subscriptionStartDate": "2020-01-01T00:00:00.000Z",
  "subscriptionEndDate": "2020-12-31T23:59:59.999Z",
  "minInvestment": 5000,
  "isActive": true,
  "constituents": [...]
}

GET http://localhost:3001/baskets/public/<basket-id>

# Expected: resolvedStatus = "CLOSED"
```

### Test Case 14: OPEN Status (Current)
```bash
POST http://localhost:3001/baskets/cms
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Current Basket",
  "category": "Test",
  "status": "OPEN",
  "subscriptionStartDate": "2024-01-01T00:00:00.000Z",
  "subscriptionEndDate": "2025-12-31T23:59:59.999Z",
  "minInvestment": 5000,
  "isActive": true,
  "constituents": [...]
}

GET http://localhost:3001/baskets/public/<basket-id>

# Expected: resolvedStatus = "OPEN"
```

---

## Database Integrity Testing

### Test Case 15: Verify Slug Generation
```sql
-- Check that slug is auto-generated
SELECT id, name, slug FROM "StockBasket";

-- Slug should be kebab-case version of name
-- Example: "High Growth Tech" → "high-growth-tech"
```

### Test Case 16: Verify Audit Trail
```sql
-- Check createdById and updatedById are set
SELECT 
  id, 
  name, 
  "createdById", 
  "updatedById", 
  "createdAt", 
  "updatedAt" 
FROM "StockBasket";
```

### Test Case 17: Verify Constituents Created
```sql
-- Check constituents are linked correctly
SELECT 
  bc.id,
  bc."basketId",
  bc."stockId",
  bc.weight,
  s.name as stock_name
FROM "BasketConstituent" bc
JOIN "Stock" s ON bc."stockId" = s.id
WHERE bc."basketId" = '<basket-id>';

-- Sum of weights should equal 100
SELECT SUM(weight) FROM "BasketConstituent" WHERE "basketId" = '<basket-id>';
```

### Test Case 18: Verify Version History Created
```sql
-- Check version records
SELECT 
  "entityType",
  "entityId",
  "versionNumber",
  "changeType",
  "changeNote",
  "createdAt"
FROM "ContentVersion"
WHERE "entityType" = 'BASKET' AND "entityId" = '<basket-id>'
ORDER BY "versionNumber" DESC;
```

---

## Transaction Testing

### Test Case 19: Constituent Creation Rollback
This requires code modification to simulate error:
1. Temporarily add error throw after basket creation
2. Attempt to create basket
3. Verify neither basket nor constituents are created
4. Remove error and verify normal operation

---

## Load Testing (Optional)

### Test Case 20: Multiple Concurrent Requests
```bash
# Use a tool like Apache Bench
ab -n 1000 -c 10 http://localhost:3001/baskets/public

# Verify:
# - No errors
# - Consistent response times
# - Cache working properly
```

---

## Success Criteria

 All CRUD operations work correctly  
 Validation prevents invalid data  
 Authorization blocks unauthorized access  
 Caching works and invalidates properly  
 Price calculation is accurate  
 Status resolution follows business logic  
 Version history tracks all changes  
 Audit trail captures admin actions  
 Slug auto-generation works  
 Transactions ensure data consistency  
 Public endpoints return only active baskets  
 CMS endpoints return all baskets  

---

## Cleanup After Testing

```sql
-- Delete test baskets
DELETE FROM "BasketConstituent" WHERE "basketId" IN (
  SELECT id FROM "StockBasket" WHERE name LIKE 'Test%'
);

DELETE FROM "ContentVersion" WHERE "entityType" = 'BASKET' AND "entityId" IN (
  SELECT id FROM "StockBasket" WHERE name LIKE 'Test%'
);

DELETE FROM "StockBasket" WHERE name LIKE 'Test%';
```

```bash
# Clear Redis cache
redis-cli FLUSHDB
```
