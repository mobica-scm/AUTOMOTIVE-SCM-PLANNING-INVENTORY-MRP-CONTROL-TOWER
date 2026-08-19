# SCM Planning, Inventory & MRP Control Tower

A working MVP of the planning loop described in the project blueprint:

```
Customer Forecast → BOM Explosion → Time-Phased MRP → Net Requirement
  → Supplier Lead Time → Planned Order → Planner Review → Exceptions
```

Built and seeded from four real source files (materials, suppliers/lead
times/shipment log, forecast, and the company's own MOQ/stock order
sheet) — not synthetic data.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind** — UI and API routes in one app.
- **Prisma + SQLite** for dev/demo (zero external services to run this). The schema uses no SQLite-only features; switching `provider` in `prisma/schema.prisma` to `"postgresql"` and pointing `DATABASE_URL` at a real instance is the only change needed for production, per the blueprint's technology architecture (Section B).
- **ExcelJS** for all spreadsheet parsing (one-time seed migration and the live forecast-upload pipeline).
- **Vitest** for the MRP engine's unit tests.

## Running it

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db
npm run db:seed          # loads the four files in ./data into it
npm run dev               # http://localhost:3000
```

`npm run db:seed` is destructive (it wipes and reloads all tables) — use it to reset to a clean, known state at any time.

## Where the core logic lives

- `lib/netting.ts` — the pure time-phased netting arithmetic (Gross Requirement − Supply = Net Requirement → MOQ/order-multiple policy → Planned Order). No Prisma, no I/O — fully unit-tested in `lib/netting.test.ts` against the exact cases in the blueprint (simple shortage, no shortage, open PO covering demand, delayed PO, MOQ, order multiple, safety stock, lead time, forecast revision, multi-period carry-forward).
- `lib/orderPolicy.ts` — MOQ + order-multiple rounding, matching the company's own Order sheet logic ("QTY after MOQ", "Final order").
- `lib/leadTime.ts` — effective lead time = manufacturing + transit + customs + inspection (calendar days for MVP; each phase is already an independent, configurable field so a working-day calendar is additive later, not a rework).
- `lib/mrp.ts` — wires the pure netting function to the database: BOM explosion by variant (L2/L3), current inventory position, confirmed scheduled receipts.
- `lib/planning.ts` — persists an MRP run: replaces only the *system-suggested* planned orders per material (never touches an APPROVED/REJECTED/CONVERTED decision) and refreshes open shortage exceptions.
- `lib/forecastParser.ts` — detects a forecast file's layout (the known Citroën CW/lot grid, or a generic part+qty+date table) and stages candidate lines for planner review. Nothing is written to the plan until a planner confirms via `/api/forecast/confirm`.

## Data model

See `prisma/schema.prisma`. Notably:

- **`SupplierPlant`, not `Supplier`, is the foreign key everywhere.** The source files spell the same plant multiple ways ("Adient Kinetra" vs. "Adient Keintra, Morocco: 21004640"); `scripts/seed.ts` resolves every known spelling through one explicit registry (`PLANTS`) rather than fuzzy-matching at import time, so lead times and material links never silently split one real plant into two records.
- **Inventory is append-only.** `InventoryTransaction` rows are the only way stock changes; the "current stock" shown anywhere is always `SUM(transactions)`, never a mutated column. The source files' single "Total Stock" number becomes the `OPENING` transaction on migration.
- **A planned order's system recommendation is never overwritten by a human override.** `recommendedQty` stays as calculated; `overrideQty` / `overrideReason` / `decidedBy` / `decidedAt` are separate fields, and every decision writes an `AuditLog` row.
- **Forecasts are versioned, never overwritten.** Each confirmed upload creates a new `ForecastVersion` with an incrementing number; the prior version is marked `SUPERSEDED`, not deleted.

## What's real vs. what's a documented placeholder

| Area | Status |
|---|---|
| BOM explosion (L2/L3 variant consumption), MRP netting, MOQ/order-multiple policy, lead-time calc | Real, tested logic — not a mock |
| Materials, suppliers, lead times, opening stock, one Citroën forecast version | Migrated from the four provided source files |
| Forecast upload → detect → review → confirm | Functional for both the known CW-grid layout and a generic part/qty/date table; a genuinely novel layout still needs the AI-assisted mapping from Section 42 of the blueprint, not yet built |
| Open PO / shipment → scheduled receipt netting | Live: `/purchase-orders` and `/shipments` create real `POLine` → `ShipmentLine` records; a `CONFIRMED`-confidence shipment with an ETA nets against demand in the MRP grid, and marking a shipment `DELIVERED` auto-posts a `RECEIPT` inventory transaction (Section 33: arrival ≠ available stock until received). The source shipment log has no material-level line items to *migrate*, so no POs are seeded from it — everything here is created going forward through the app. Approving and converting a planned order also now creates a real `PurchaseOrder`, not just a status flip |
| Auth / roles | Schema has `User.role`; no login screen yet — the planner console currently attributes actions to a fixed demo user (see `lib/useCurrentUser.ts`) |
| Working-day/holiday calendars, statistical lead-time confidence, scenario simulation, ABC/XYZ analytics, supplier risk scoring | Explicitly out of MVP scope per the blueprint (Section J/K) |

## Tests

```bash
npm test
```

15 tests in `lib/orderPolicy.test.ts` and `lib/netting.test.ts`, covering every worked example in the blueprint's Section 49 test list.
