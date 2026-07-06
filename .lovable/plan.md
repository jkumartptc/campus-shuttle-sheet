## Goal

Keep the single `driver` role, but tag each driver as either a **bus driver** or a **car driver**, and lock each type to the right pages.

| Type | Access |
|---|---|
| Bus driver | Bus Attendance (scan + list) + Bus Maintenance (all buses) |
| Car driver | Car Maintenance (all cars/vehicles) + own trip/fuel logs |
| Admin / Staff | Everything (unchanged) |
| Accounts | Fees only (unchanged) |

## Changes

### 1. Database (migration)
- Add `driver_type` column on `public.user_roles` as a new enum `driver_type` with values `bus` | `car` (nullable; only meaningful when `role = 'driver'`).
- Add a CHECK constraint: `driver_type` may only be non-null when `role = 'driver'`.
- No RLS changes to existing tables — access is enforced client-side via route gating (matches current pattern with `isPathAllowedForRole`). Fuel/maintenance write policies already allow authenticated users.

### 2. Role helpers — `src/lib/use-role.ts`
- Extend `useUserRoles` to return `{ role, driver_type }[]` (or add `useDriverType(userId)`).
- Add `DriverType = 'bus' | 'car'`.
- Update `isPathAllowedForRole(pathname, role, driverType)`:
  - `driver` + `bus` → `/attendance/*`, `/maintenance/*` (buses only, filtered in-page)
  - `driver` + `car` → `/maintenance/*` (cars only, filtered in-page), `/fuel` (or trip log surface within maintenance)
  - `driver` with no type → access denied with "Ask admin to set your driver type"
- Update `landingPathForRole`: bus driver → `/attendance/scan`; car driver → `/maintenance`.

### 3. Sidebar — `src/components/app-shell.tsx`
- Add `busDriverNav` (Scan QR, Today's Attendance, Maintenance) and `carDriverNav` (Maintenance, Fuel/Trip Logs).
- Pick the nav based on `roles` + `driver_type`.

### 4. Staff page — `src/routes/_authenticated/staff.tsx`
- When admin sets a user's role to `driver`, show a second dropdown: **Driver type** (Bus / Car).
- Save writes both `role='driver'` and `driver_type` on the `user_roles` row.
- Show current driver type as a small badge next to the role.

### 5. Maintenance & attendance pages — filter by type
- `_authenticated/maintenance.index.tsx`: if signed-in user is a driver, filter vehicle list to buses-only (bus driver) or cars-only (car driver). Admin/staff see all.
- `_authenticated/attendance.*`: unchanged behavior; gated so only bus drivers (and staff/admin) can reach it.
- Fuel/trip log entry for car drivers: reuse existing fuel entry UI on the vehicle detail page, scoped to their vehicle type.

### 6. Access-denied copy
- If a driver has no `driver_type` set, `/access-denied` shows a hint: "Your driver type isn't set. Ask an admin to mark you as Bus or Car driver on the Staff page."

## Admin workflow after this ships

1. Driver signs up on `/auth` (creates account).
2. Admin opens **Staff**, sets their role to **driver**, then picks **Bus** or **Car**.
3. Driver signs in and lands on their allowed section only.

## Out of scope (ask if you want it)

- Hard-linking a specific bus/car to a specific driver (previously discussed `bus_id` on `user_roles`). This plan gives **type-level** access as you specified ("all vehicles of their type"). Say the word if you also want per-vehicle assignment.
