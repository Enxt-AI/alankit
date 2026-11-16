# Refactor Logs

## Stock Symbol Removal and CIN Identity Refactor

## Overview
This document records the stock identity refactor completed in the stocks-service domain and its dependent flows.

The previous model used `symbol` as a business identifier in multiple places across stocks, upcoming stocks, portfolio, watchlist, API contracts, admin flows, and user-facing screens. That coupling created ambiguity between internal relational identity and business identity, and it made future changes harder because `symbol` behaved like both a display field and a primary lookup field.

The refactor removed Stock Symbols from the core model and standardized on the following rule:

- `id` is the internal relational key.
- `cin` is the unique business identifier.
- `symbol` is no longer part of the Stock and UpcomingStock domain model.

## Objectives

- Remove `symbol` from Stock management flows.
- Make `cin` mandatory and unique for stock records.
- Keep `cin` immutable after creation.
- Apply the same identity model to UpcomingStock.
- Migrate portfolio relationships to use `stockId` instead of a symbol-based reference.
- Update admin and user-facing experiences to display and operate on CIN.

## Architectural Decision

The domain now separates public business identity from internal database identity:

- `Stock.id` remains the internal foreign-key target for relations.
- `Stock.cin` is the externally meaningful business identifier used in admin workflows, validation, listing, and user-facing display.
- Relations that previously depended on `stockSymbol` must instead point to `stockId`.

This change reduces identity drift and avoids treating a mutable display-like field as a relational anchor.

## Scope of Changes

### 1. Data Model and Persistence

- Removed `symbol` from `Stock`.
- Removed `symbol` from `UpcomingStock`.
- Enforced CIN as the business identifier for both entities.
- Preserved `id` as the primary internal relational key.
- Migrated portfolio references from `stockSymbol` to `stockId`.
- Updated conversion flows so UpcomingStock to Stock promotion carries CIN forward correctly.

### 2. Backend Contracts

- Updated DTOs, services, controllers, and query paths to stop accepting or returning symbol-based stock identity.
- Replaced symbol-oriented lookups with CIN or internal ID, depending on the use case.
- Preserved backend behavior where `id` is used for joins and relation integrity.
- Ensured mutation paths do not allow CIN to be edited after creation.

### 3. Frontend and Shared Types

- Updated shared types and validation schemas to remove stock symbol assumptions.
- Updated admin stock management forms to create and edit stocks without Symbol.
- Updated stock lists and related UI to surface CIN where identity is required.
- Updated user-facing portfolio and watchlist flows to align with `stockId` and CIN-based display.

### 4. Regression-Sensitive Flows

The highest-risk flows during this refactor were:

- stock creation and editing
- upcoming stock creation and conversion
- watchlist references during conversion
- portfolio holdings and stock mapping
- basket-related stock display and constituent lookup

These areas were reviewed and validated after the refactor.

## Business Rules After Refactor

### Stock

- A stock must have a CIN.
- CIN is the business-level unique identifier.
- CIN is immutable after creation.
- Internal references should use `stockId`, not CIN and not Symbol, when relation integrity is required.

### UpcomingStock

- An upcoming stock must also have a CIN.
- CIN is carried forward when an upcoming stock is converted into a live stock.
- Symbol is not used as a temporary placeholder or alternate identifier.

### Portfolio and Watchlist

- Portfolio records must reference the internal stock relation through `stockId`.
- Watchlist and conversion flows must maintain relational consistency when an upcoming stock becomes a stock.
- User-facing displays should show CIN where identity needs to be visible.

## Why This Refactor Was Necessary

The old symbol-based model caused several structural problems:

- `symbol` was overloaded as both a business identifier and a relation key.
- symbol-based relationships are brittle compared to internal IDs.
- UI and API contracts were carrying unnecessary assumptions about stock identity.
- conversion flows between upcoming and live stocks had to preserve symbol semantics even when CIN was the true business identity.

Moving to `id` plus immutable `cin` establishes a clearer contract:

- relational integrity uses `id`
- business identity uses `cin`
- display concerns no longer drive persistence design

## Verification Summary

After the refactor, the following verification work was completed:

- Prisma schema generation and service builds completed successfully.
- stocks-service build completed successfully.
- panels build completed successfully.
- web build completed successfully.
- focused e2e stabilization work was completed for stocks-service.
- stocks-service e2e suite completed successfully with 3 passing suites and 24 passing tests.
- targeted regression sweeps found no remaining Symbol or `stockSymbol` references in the priority watchlist, portfolio, upcoming-stock, and basket paths.

## Test Notes

The stocks-service e2e runner required follow-up stabilization during verification. That work is part of this refactor history because it was necessary to validate the migration reliably.

Key test stabilization steps included:

- closing leaked Nest app instances in e2e setup
- running Prisma migrations before e2e execution
- invoking Jest directly for consistent Windows execution
- ensuring Fastify readiness in the user-journey suite
- forcing mock-mode test state where required by KYC, Demat, payment, and email flows

## Upcoming Stock Domain Cleanup

After the Symbol removal work, UpcomingStock still retained a content-style `description` field and still allowed `name` edits after creation. That left UpcomingStock with a looser identity model than the live Stock domain, even though both entities were already expected to use CIN as the business identifier.

This follow-up cleanup aligned UpcomingStock with the stricter identity rules.

### Additional Rules Introduced

- `UpcomingStock.name` is immutable after creation.
- `UpcomingStock.cin` remains required, unique, and immutable.
- `UpcomingStock.description` is no longer part of the UpcomingStock domain model.

### What Changed

#### Data model

- Removed `description` from the `UpcomingStock` Prisma model.
- Added a database migration to drop the underlying column.

#### Backend behavior

- Removed `description` from UpcomingStock create and update DTOs.
- Removed `name` from the UpcomingStock update DTO so identity fields cannot be edited.
- Updated service-layer selects and persistence paths to stop reading or writing UpcomingStock descriptions.
- Normalized rollback behavior so historical versions cannot reapply legacy `name`, `cin`, or `description` values.
- Updated UpcomingStock-to-Stock conversion so the created Stock starts with `description: null` instead of inheriting a deleted UpcomingStock field.

#### Frontend and shared contracts

- Removed UpcomingStock `description` from panels and web types.
- Updated UpcomingStock validation so create-time identity fields remain available only during creation.
- Removed Description from admin and CMS Upcoming Stock forms, list tables, detail cards, and the public Upcoming Stock details page.
- Disabled Upcoming Stock name editing in admin and CMS edit flows.

#### Compatibility handling

- Watchlist responses still expose a stable `description` field for the shared stock card shape.
- For UpcomingStock-backed watchlist rows, that field is now explicitly normalized to `null` instead of being sourced from UpcomingStock data.

### Verification for This Follow-up

- Prisma client generation completed successfully after a transient Windows file-lock retry.
- `db-unlisted-stox` generated successfully with the new UpcomingStock schema.
- `stocks-service`, `panels`, and `web` builds completed without reported source errors.
- editor Problems checks across the affected packages returned no errors.

## Implementation Outcome

The stock domain now uses a cleaner identity model:

- `id` for internal relationships
- `cin` for business identity
- no Symbol dependency in Stock and UpcomingStock management

This refactor reduces coupling across the stack and makes future stock-related changes easier to reason about, especially in portfolio, watchlist, conversion, and admin-management flows.

## Recommended Rule Going Forward

When introducing or reviewing stock-related changes:

- do not reintroduce `symbol` as a data dependency
- use `stockId` for relations
- use `cin` for business identity and admin/user display where appropriate
- treat CIN as immutable unless a deliberate data-migration plan is created