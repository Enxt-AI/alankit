# Stocks API Reference

This document describes the `stocks-service` HTTP API related to regular stocks, upcoming stocks, watchlist, and the upcoming→regular conversion.

Notes:
- Base prefix is typically `/api` (depends on reverse-proxy setup). Examples below omit the host.
- **Upcoming stocks are hard-deleted** from the database when deleted or converted.
- **Regular stocks are soft-deleted** by setting `isActive=false`.

## Stock browsing (Public)

### List active stocks
- `GET /stocks`
- Returns only active regular stocks.
- Includes `isPopular` on each stock so clients can derive “Popular” tab client-side.

### Stock details
- `GET /stocks/:id`

## Upcoming stock browsing (Public)

### List active upcoming stocks
- `GET /upcoming-stocks`

### Upcoming stock details (by symbol)
- `GET /upcoming-stocks/symbol/:symbol`

## Stocks management (Admin)

### List all (includes inactive)
- `GET /stocks/admin/all`

### Create
- `POST /stocks/admin`

### Update
- `PUT /stocks/admin/:id`

### Delete (soft delete)
- `DELETE /stocks/admin/:id`
- Behavior: sets `isActive=false` (record remains).

## Upcoming stocks management (Admin)

Legacy routes (kept for backward compatibility):
- `GET /upcoming-stocks/admin/all`
- `POST /upcoming-stocks/admin`
- `PUT /upcoming-stocks/admin/:id`
- `DELETE /upcoming-stocks/admin/:id` (hard delete)
- `POST /upcoming-stocks/admin/:id/convert` (convert)

Alias routes (preferred new grouping):
- `GET /admin/upcoming-stocks/all`
- `POST /admin/upcoming-stocks`
- `PUT /admin/upcoming-stocks/:id`
- `DELETE /admin/upcoming-stocks/:id`
- `POST /admin/upcoming-stocks/:id/convert`

### Convert upcoming → regular
- `POST /upcoming-stocks/admin/:id/convert` (legacy)
- `POST /admin/upcoming-stocks/:id/convert` (alias)

Response shape:
```json
{
  "success": true,
  "message": "Upcoming stock converted to regular stock successfully",
  "data": {
    "newStockId": "...",
    "symbol": "...",
    "name": "..."
  }
}
```

Side effects:
- Creates a new regular `Stock`.
- Copies directors + documents.
- Migrates watchlist items (`watchlistItem.stockId` set; `upcomingStockId` cleared).
- Hard deletes the original upcoming stock.
- Creates an audit log entry with action `CONVERT` for entity `UPCOMING_STOCK`.

## Upcoming stocks management (CMS)

Legacy routes (kept for backward compatibility):
- `GET /upcoming-stocks/cms/all`
- `POST /upcoming-stocks/cms`
- `PUT /upcoming-stocks/cms/:id`
- `DELETE /upcoming-stocks/cms/:id` (hard delete)
- `POST /upcoming-stocks/cms/:id/convert` (convert)

Alias routes (preferred new grouping):
- `POST /cms/upcoming-stocks/:id/convert`

## Watchlist (User)

### Get watchlist
- `GET /watchlist`

### Toggle regular stock
- `POST /stocks/:id/watchlist`

### Toggle upcoming stock
- `POST /upcoming-stocks/:id/watchlist`

## Audit logs (Admin/CMS)

### Fetch logs for an entity
- `GET /audit/entity/:entityType/:entityId`

For conversion history of an upcoming stock, use:
- `entityType=UPCOMING_STOCK`
- `entityId=<upcomingStockId>`
