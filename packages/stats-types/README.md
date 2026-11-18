# Stats Types Package

Shared TypeScript interfaces for statistics and analytics across services.

## Overview

This package contains common type definitions used across multiple services and the frontend application to ensure type safety and consistency in the statistics API boundary.

## Interfaces

### `SupportTicketStats`

Statistics for support ticket dashboard including KPIs and chart data for ticket analytics.

```typescript
interface SupportTicketStats {
  totalTickets: number;
  openTickets: number;
  resolvedToday: number;
  slaBreached: number;
  avgResolutionTime: number;
  slaCompliance: number;
  ticketsByStatus: Array<{ status: string; count: number }>;
  ticketsByPriority: Array<{ priority: string; count: number }>;
  resolutionTrend: Array<{ date: string; count: number }>;
}
```

### `SupportStatsFilters`

Query parameters for support ticket statistics.

```typescript
interface SupportStatsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  agentId?: string;
}
```

## Usage

### Backend (ticketing-service)

```typescript
import { SupportTicketStats, SupportStatsFilters } from 'stats-types';

export class ReportService {
  async getTicketStats(filters: SupportStatsFilters): Promise<SupportTicketStats> {
    // Implementation
  }
}
```

### Frontend (web app)

```typescript
import { SupportTicketStats, SupportStatsFilters } from 'stats-types';

function useSupportStats(filters: SupportStatsFilters) {
  // Implementation
}
```

## Development

### Building

```bash
pnpm run build
```

### Publishing

This package is part of the monorepo workspace and should be published via the workspace tooling.

## Extending Shared Types

When adding new shared statistics types:

1. Add the interface to `src/index.ts`
2. Update the version in `package.json`
3. Rebuild the package
4. Update consuming services to use the shared types
5. Remove any duplicate local definitions

This ensures type safety across the API boundary and prevents drift between backend and frontend interfaces.