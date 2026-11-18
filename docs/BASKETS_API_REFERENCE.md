# Stock Baskets API Reference

## Base URL
`http://localhost:3001/baskets`

---

## Public Endpoints (No Authentication)

### 1. Get All Active Baskets
**Endpoint:** `GET /baskets/public`

**Description:** Returns all active baskets with calculated prices and resolved statuses. Response is cached for 5 minutes.

**Response:**
```json
[
  {
    "id": "basket_id",
    "name": "High Growth Tech Basket",
    "slug": "high-growth-tech-basket",
    "description": "Curated collection of high-growth tech stocks",
    "tagline": "Invest in the future of technology",
    "category": "High Growth",
    "iconUrl": "https://example.com/icon.png",
    "status": "OPEN",
    "subscriptionStartDate": "2024-01-01T00:00:00Z",
    "subscriptionEndDate": "2024-12-31T23:59:59Z",
    "minInvestment": 10000,
    "priceEffectiveDate": "2024-01-01T00:00:00Z",
    "isActive": true,
    "currentPrice": 12500.50,
    "resolvedStatus": "OPEN",
    "constituents": [
      {
        "id": "constituent_id",
        "basketId": "basket_id",
        "stockId": "stock_id",
        "weight": 40,
        "stock": {
          "id": "stock_id",
          "name": "Tech Company A",
          "price": 5000
        }
      },
      // ... more constituents
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### 2. Get Basket by ID
**Endpoint:** `GET /baskets/public/:id`

**Description:** Returns a single basket by ID with calculated price and resolved status. Response is cached for 5 minutes.

**Parameters:**
- `id` (path) - Basket ID

**Response:** Same as individual basket object above

**Error Responses:**
- `404 Not Found` - Basket with given ID doesn't exist

---

## CMS Endpoints (Require Authentication + 'cms_baskets' Permission)

### 3. Get All Baskets (Admin View)
**Endpoint:** `GET /baskets/cms`

**Description:** Returns all baskets including inactive ones with full details.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
[
  {
    "id": "basket_id",
    "name": "High Growth Tech Basket",
    "slug": "high-growth-tech-basket",
    "description": "Curated collection of high-growth tech stocks",
    "tagline": "Invest in the future of technology",
    "category": "High Growth",
    "iconUrl": "https://example.com/icon.png",
    "status": "DRAFT",
    "subscriptionStartDate": "2024-01-01T00:00:00Z",
    "subscriptionEndDate": "2024-12-31T23:59:59Z",
    "minInvestment": 10000,
    "priceEffectiveDate": "2024-01-01T00:00:00Z",
    "isActive": false,
    "createdById": "admin_id",
    "updatedById": "admin_id",
    "constituents": [
      {
        "id": "constituent_id",
        "basketId": "basket_id",
        "stockId": "stock_id",
        "weight": 40,
        "stock": {
          "id": "stock_id",
          "name": "Tech Company A",
          "symbol": "TECH_A",
          "price": 5000,
          "description": "Leading tech company",
          "logoUrl": "https://example.com/logo.png",
          "tags": ["technology", "growth"],
          "isin": "US1234567890",
          "isActive": true
        }
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### 4. Create Basket
**Endpoint:** `POST /baskets/cms`

**Description:** Creates a new stock basket with constituents.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "High Growth Tech Basket",
  "description": "Curated collection of high-growth tech stocks",
  "tagline": "Invest in the future of technology",
  "category": "High Growth",
  "iconUrl": "https://example.com/icon.png",
  "status": "DRAFT",
  "subscriptionStartDate": "2024-01-01T00:00:00.000Z",
  "subscriptionEndDate": "2024-12-31T23:59:59.999Z",
  "minInvestment": 10000,
  "priceEffectiveDate": "2024-01-01T00:00:00.000Z",
  "isActive": true,
  "constituents": [
    {
      "stockId": "stock_id_1",
      "weight": 40
    },
    {
      "stockId": "stock_id_2",
      "weight": 35
    },
    {
      "stockId": "stock_id_3",
      "weight": 25
    }
  ]
}
```

**Validation Rules:**
- `name`: Required, string
- `description`: Optional, string
- `tagline`: Optional, string
- `category`: Required, string
- `iconUrl`: Optional, string, must be valid URL
- `status`: Optional, enum (DRAFT, OPEN, CLOSED, COMING_SOON)
- `subscriptionStartDate`: Optional, ISO 8601 date string
- `subscriptionEndDate`: Optional, ISO 8601 date string
- `minInvestment`: Required, number >= 0
- `priceEffectiveDate`: Optional, ISO 8601 date string
- `isActive`: Optional, boolean
- `constituents`: Required array with at least 1 item
  - `stockId`: Required, string
  - `weight`: Required, number between 0-100
  - **Important:** Sum of all weights must equal 100

**Response:** Created basket object with constituents

**Error Responses:**
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Invalid or missing JWT token
- `403 Forbidden` - Missing 'cms_baskets' permission

---

### 5. Update Basket
**Endpoint:** `PUT /baskets/cms/:id`

**Description:** Updates an existing basket. All fields are optional.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Parameters:**
- `id` (path) - Basket ID

**Request Body:**
```json
{
  "name": "Updated Basket Name",
  "status": "OPEN",
  "isActive": true,
  "constituents": [
    {
      "stockId": "stock_id_1",
      "weight": 50
    },
    {
      "stockId": "stock_id_2",
      "weight": 50
    }
  ]
}
```

**Notes:**
- Only include fields you want to update
- If `constituents` is provided, all existing constituents are replaced
- Weight validation still applies (must sum to 100)

**Response:** Updated basket object with constituents

**Error Responses:**
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Invalid or missing JWT token
- `403 Forbidden` - Missing 'cms_baskets' permission
- `404 Not Found` - Basket with given ID doesn't exist

---

### 6. Delete Basket (Soft Delete)
**Endpoint:** `DELETE /baskets/cms/:id`

**Description:** Soft deletes a basket by setting isActive to false.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Parameters:**
- `id` (path) - Basket ID

**Response:** Deleted basket object with `isActive: false`

**Error Responses:**
- `401 Unauthorized` - Invalid or missing JWT token
- `403 Forbidden` - Missing 'cms_baskets' permission
- `404 Not Found` - Basket with given ID doesn't exist

---

### 7. Get Basket Version History
**Endpoint:** `GET /baskets/cms/:id/versions`

**Description:** Returns version history for a basket showing all changes.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Parameters:**
- `id` (path) - Basket ID

**Response:**
```json
[
  {
    "id": "version_id",
    "entityType": "BASKET",
    "entityId": "basket_id",
    "versionNumber": 3,
    "content": "{\"name\":\"Updated Name\",\"status\":\"OPEN\"}",
    "changeType": "UPDATED",
    "changeNote": "Basket updated: Updated Name",
    "changedById": "admin_id",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  {
    "id": "version_id_2",
    "entityType": "BASKET",
    "entityId": "basket_id",
    "versionNumber": 2,
    "content": "{\"name\":\"First Update\"}",
    "changeType": "UPDATED",
    "changeNote": "Basket updated: First Update",
    "changedById": "admin_id",
    "createdAt": "2024-01-10T14:20:00Z"
  },
  {
    "id": "version_id_3",
    "entityType": "BASKET",
    "entityId": "basket_id",
    "versionNumber": 1,
    "content": "{\"name\":\"High Growth Tech Basket\",\"category\":\"High Growth\"}",
    "changeType": "CREATED",
    "changeNote": "Basket created: High Growth Tech Basket",
    "changedById": "admin_id",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing JWT token
- `403 Forbidden` - Missing 'cms_baskets' permission

---

## Status Resolution Logic

The `resolvedStatus` field is calculated dynamically based on:

1. If `status` is `DRAFT` or `CLOSED` → returns as-is
2. If current date < `subscriptionStartDate` → returns `COMING_SOON`
3. If current date > `subscriptionEndDate` → returns `CLOSED`
4. Otherwise → returns `OPEN`

---

## Price Calculation

The `currentPrice` is calculated as:
```
currentPrice = Σ(stock.price × constituent.weight / 100)
```

Example:
- Stock A: ₹5000, weight 40% → ₹2000
- Stock B: ₹3000, weight 35% → ₹1050
- Stock C: ₹2000, weight 25% → ₹500
- **Total Basket Price: ₹3550**

---

## Caching Strategy

**Public Endpoints:**
- Cache Key Pattern: `baskets:active` and `baskets:{id}`
- TTL: 5 minutes (300 seconds)
- Invalidation: On any create/update/delete operation

**CMS Endpoints:**
- No caching (always fresh data for admins)

---

## Permission Requirements

All CMS endpoints require:
1. Valid JWT token in Authorization header
2. Admin account with `cms_baskets` permission

To add permission to an admin:
```sql
UPDATE "Admin" 
SET permissions = array_append(permissions, 'cms_baskets') 
WHERE email = 'admin@example.com';
```
