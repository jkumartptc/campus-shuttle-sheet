## Goal
Add role-based access (admin/driver/accounts), universal register-number search across modules, and route protection — without changing existing UI/design.

## 1. Roles & Auth
- Extend `app_role` enum to add `accounts` (currently has admin/staff/driver).
- Update `useUserRoles` consumers; add helper `usePrimaryRole()` returning `admin | driver | accounts | staff`.
- Create `<RoleGuard allow={[...]}/>` wrapper + an `/access-denied` route.
- Wrap each `_authenticated/*` route's component with appropriate RoleGuard:
  - Driver: only `/attendance*`
  - Accounts: only `/fees`
  - Admin/staff: all
- Update `AppShell` nav:
  - Driver: Scan QR, Today's Attendance, Logout (already exists)
  - Accounts: Fees Collection only
  - Admin: full nav (add Reports → `/attendance/reports`, Settings placeholder if missing — skip if not requested as new pages; map to existing).
- Default landing after login by role: admin→/dashboard, driver→/attendance/scan, accounts→/fees.

## 2. Universal Register Number Search
Add a reusable `<RegisterNumberSearch>` component (debounced, instant filter) used in:
- Students list (already has search — extend to also match register no/department/route/stop)
- Fees Collection (add search; show photo, fee status, paid, balance, receipt no, history)
- Transport Requests (add search; show request status, route, boarding point, approval)
- Bus Attendance overview (add search; show photo, name, dept, route, today morning/evening times, attendance %)

Each module gets a search input filtering its existing query results client-side (instant). Display panel renders matched student card with module-specific fields.

## 3. Security
- RoleGuard checks roles from DB (already via `useUserRoles`) — show loader while fetching, redirect to `/access-denied` if not allowed.
- Auth route redirects by role after login.

## 4. Out of scope (preserve existing)
- No UI redesign; reuse shadcn cards/inputs/tables.
- No changes to bus pass logic, fee sync trigger, QR scanner logic.
- "Reports" and "Settings" admin items only added if existing routes exist — Reports maps to `/attendance/reports`; Settings is not a current route, skip unless user wants a stub.

## Technical notes
- Migration: `ALTER TYPE app_role ADD VALUE 'accounts';` (separate migration, cannot mix with usage in same tx).
- Promotion of users to accounts/driver continues via existing Staff page (admin assigns roles).
- All route protection client-side via RoleGuard; backend RLS unchanged (existing policies already use `has_role`).
