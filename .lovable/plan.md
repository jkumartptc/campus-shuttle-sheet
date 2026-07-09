# Unified Fleet Maintenance Module

This rebuilds maintenance around a single per-vehicle dashboard driven by `vehicle_master`, so any future vehicle plugs in with no code changes.

## 1. Seed / configure fleet

Insert (idempotent) into `vehicle_master`:
- Bus — `TN11Z4470`
- Car — Mahindra XUV-500 (`KMKA7585`)
- Car — Jeep Compass (`KA02MN4181`)

Existing Demo Vehicle handling is preserved.

## 2. Database changes (single migration)

New / extended tables — all with `created_by`, `updated_by`, `created_at`, `updated_at`, an update trigger, GRANTs + RLS (staff/admin full, drivers scoped by `driver_type` matching vehicle category):

- `odometer_logs` — vehicle_id, reading_km (mandatory), driver_id, remarks, logged_at (default `now()`, read-only from client). Trigger enforces monotonic reading per vehicle, blocks duplicates within 5 min, computes `distance_km` since previous entry, and flags `anomaly` when > 3× 30-day median daily distance.
- Extend `fuel_logs` with: `intent_no`, `bill_no`, `fuel_station` (default "Five Roads Fuel Service Station"), `credit_purchase` bool default true, `payment_status` enum (`pending|billed|paid`), `invoice_url` (Storage), `created_by`, `updated_by`. Existing mileage trigger reused.
- `vehicle_documents` — vehicle_id, doc_type enum (`insurance|fc|permit|puc|other`), doc_no, issued_on, expires_on, provider, file_url, notes. One "current" row per (vehicle, doc_type) via partial unique index.
- `service_schedules` — vehicle_id, item (e.g. "Engine oil"), interval_km, interval_days, last_done_on, last_done_km, next_due_on, next_due_km.
- `tyres` — vehicle_id, position, brand, fitted_on, fitted_km, removed_on, removed_km, notes.

New Storage bucket `vehicle-docs` (private) for invoices and document scans.

DB views for dashboard/reports:
- `vehicle_dashboard` — per vehicle: current odometer, last odo entry time, last fuel date, km since last fuel, running avg mileage (last 5 fills), month-to-date litres & cost, next service due, next expiring doc per type.
- `monthly_running`, `monthly_fuel` — grouped aggregates for reports.

## 3. Routes

- `/_authenticated/vehicles` — fleet grid (cards using `vehicle_dashboard`): current odo, last fuel, mileage, upcoming due dates. Search + filter (category, status, expiring soon).
- `/_authenticated/vehicles/$id` — unified vehicle dashboard with tabs:
  1. Vehicle Information (edit master + summary tiles)
  2. Odometer Log
  3. Fuel Log
  4. Maintenance History (existing `maintenance_records`)
  5. Service Schedule (`service_schedules` + due-soon badges)
  6. Repairs (maintenance_records filtered by type ≠ Periodic)
  7. Insurance / FC / Permit / PUC — each a `vehicle_documents` filtered view with expiry countdown, renew action, upload
  8. Tyres
  9. Documents (all uploads, generic bucket browser)
- `/_authenticated/reports/fleet` — report picker (Daily Odo, Monthly Running, Fuel Consumption, Efficiency, Maintenance Cost, Monthly Operating Cost, Service History, Fuel History, Intent Register, Fuel Bill Register), with CSV/Excel + print-to-PDF.

Existing `/maintenance` and `/fuel-log` become redirects / thin wrappers pointing to the new pages so drivers' sidebar keeps working.

## 4. Automatic audit fields

All inserts/updates go through server functions (`createServerFn` + `requireSupabaseAuth`) so `created_by` / `updated_by` are filled from `context.userId` and `logged_at` is `now()` — never accepted from the client. Client forms hide date/time fields (or show as read-only "auto").

## 5. Notifications

Server route `/api/public/hooks/vehicle-reminders` scanned by `pg_cron` daily at 07:00. It reads `vehicle_dashboard` + `service_schedules` + `vehicle_documents`, and:
- creates in-app reminder rows (new `reminders` table) shown as a bell menu in app shell
- reuses the existing driver browser-notification pattern for drivers assigned to that vehicle category

Existing daily odometer reminder component keeps working.

## 6. UI / UX

- shadcn Tabs inside the vehicle dashboard, responsive (mobile drops to accordion).
- Global search over vehicles by name / reg no.
- Dialog-based entry for odometer & fuel; forms show computed values live (distance since last, litres × rate).
- All timestamps rendered with `fmtDate` / relative time; no manual date pickers for logs.

## Technical notes

- Driver scoping: `has_role(uid,'admin')` OR `has_role(uid,'staff')` OR (`driver` role AND `user_roles.driver_type` matches vehicle `category` mapping bus↔Bus, car↔non-Bus).
- Server functions live in `src/lib/fleet.functions.ts`; admin/service-role usage limited to storage signed URLs.
- Reports use existing CSV helper pattern; PDF via `window.print()` with a print stylesheet on the report page.
- No breaking changes to `attendance`, `fees`, `bus-passes`, `students`.

## Out of scope (ask if wanted)

- True background push (needs service worker + VAPID + web-push server).
- Accounts-module integration beyond `payment_status` field on fuel entries.
- OCR of uploaded invoices.

Confirm and I'll ship the migration + routes in one pass.
