## Bus Attendance Module

A new self-contained module added alongside existing Transport, Fees, Routes, Staff, and Maintenance modules. Nothing existing is modified beyond adding a sidebar link and a tab on the student profile.

### 1. Database (one migration)

New `app_role` value: `driver` (added to existing `app_role` enum).

New table `public.attendance`:
- `student_id`, `attendance_date` (date), `attendance_time` (timestamptz), `trip` (`'morning' | 'evening'`), `route_id`, `device_name`, `user_id`, `latitude`, `longitude`, `remarks`, `created_at`
- Unique index on `(student_id, attendance_date, trip)` to prevent duplicates
- GRANT + RLS: authenticated can SELECT; INSERT allowed for `driver`/`staff`/`admin`; UPDATE/DELETE admin only

New column `students.qr_token uuid unique` auto-generated for every student (existing + new via default + backfill).

### 2. Sidebar

Add **Bus Attendance** entry (icon: ScanLine) in `src/components/app-sidebar.tsx` pointing to `/attendance`. Driver-role users see only: Scan QR, Today's Attendance, Logout (the rest of the sidebar is hidden when `role === 'driver'`).

### 3. Routes

```
src/routes/_authenticated/
  attendance.tsx              -> dashboard cards + tabs (Scan / Manual / Reports)
  attendance.scan.tsx         -> mobile driver scan page
  attendance.manual.tsx       -> admin-only manual marking
  attendance.reports.tsx      -> filters + export Excel/PDF
  students.$id.tsx            -> add Attendance tab (history + %)
```

### 4. Dashboard cards (`/attendance`)

Today's Morning count, Today's Evening count, Students on Board (latest trip count), Absent Students (active students − present), Last Scan Time.

### 5. Scan page (`/attendance/scan`)

- Mobile-first, large "Scan QR" button
- Uses `html5-qrcode` (Worker-safe, pure JS) for camera scanning
- On scan: lookup `students` by `qr_token` → show photo, name, roll, dept, route, stop
- Auto-detect trip: `< 12:00` morning, else evening
- Insert attendance, catching unique-violation as "already marked"
- Success beep via WebAudio oscillator (no asset needed); error toast on invalid/duplicate
- Capture `navigator.geolocation` (best-effort), device name from `navigator.userAgent`

### 6. Offline support

- IndexedDB queue (via small wrapper in `src/lib/attendance-offline.ts`)
- Online/Offline badge + pending count in scan page header
- `window.ononline` flush; also on app mount

### 7. Student profile Attendance tab

Table of last 60 days with morning/evening time + status; attendance % = present_days / school_days_in_range.

### 8. Reports

Filters: date, month, academic year, route. Tables for Daily, Monthly, Student-wise, Route-wise. Export Excel via `xlsx` (already-installed-or-add), PDF via existing `jspdf`.

### 9. QR generation

Each student row in students list gets a "QR" button to open dialog rendering `qrcode` lib → PNG download. QR payload = `qr_token` only (UUID), no PII.

### 10. Driver role

`has_role(uid,'driver')`. New users with role `driver` redirected to `/attendance/scan` on login; sidebar filtered.

### Packages to add
`html5-qrcode`, `qrcode`, `xlsx`, `idb`

### Out of scope (explicit)
No changes to existing Transport/Fees/Routes/Staff/Maintenance code paths. Existing student/payments/pdf flows untouched.
