## Digital e-Bus Pass Module

A new self-contained module that issues secure QR-based bus passes to fee-paid students, integrates with the existing Bus Attendance scanner, and adds admin controls + reports. Existing Students, Fees, Routes, Staff, Requests, and Maintenance modules are not modified.

### 1. Database (one migration)

New table `public.bus_pass`:
- `id` uuid PK, `student_id` uuid FK → students (unique — one active pass per student)
- `pass_id` text unique (human-readable, e.g. `TPT-2026-AB12CD34`)
- `qr_token` uuid unique (random, this is what's in the QR — no PII)
- `route_id`, `boarding_point` text, `bus_number` text (snapshot at issue time)
- `fee_status` text (`paid`/`pending`, snapshot — live status still checked on scan)
- `pass_status` text: `active` | `expired` | `fee_pending` | `cancelled`
- `valid_from` date, `valid_to` date, `academic_year` text
- `download_count` int default 0, `last_download` timestamptz
- `issued_by` uuid (admin), `created_at`, `updated_at`
- GRANT + RLS: SELECT/INSERT/UPDATE/DELETE for `authenticated` (admin/staff via app); narrow `SELECT` for `anon` only via a SECURITY DEFINER RPC (see below), not direct table access.

Public lookup RPC `public.get_bus_pass_public(p_register_no text, p_mobile text)`:
- SECURITY DEFINER, returns pass + student snapshot only when register no + mobile match AND fee paid AND transport active.
- Granted to `anon` and `authenticated`. Returns a typed row; raises typed error codes otherwise.

Reuse existing `attendance` table — extend scanner to also reject if pass is cancelled/expired or fee pending.

### 2. Public student portal (no login)

New top-level route `src/routes/bus-pass.tsx`:
- College header (logo + "THIAGARAJAR POLYTECHNIC COLLEGE / Salem – 636005 / Transport Bus Pass / AY <dynamic>").
- Form: Register Number, Mobile Number, **Get Bus Pass** button.
- Calls `get_bus_pass_public` RPC. On success → renders Bus Pass card with Download PDF / Print / Save as Image buttons. On failure → "Transport fee is pending or student is not registered for transport."
- Increments `download_count` + `last_download` via a second RPC on download.

### 3. Bus Pass design (shared component)

`src/components/bus-pass-card.tsx` — printable A5 portrait card:
- Header: logo + college name + Salem – 636005 + "TRANSPORT BUS PASS" + AY.
- Left: student photo (signed URL).
- Right: Name, Register No, Department, Year/Sem, Route, Boarding Point, Bus No, Mobile, Blood Group, Validity, Fee Status, Pass Status badge, Pass ID.
- Center-bottom: large QR (qr_token only).
- Footer: "Show this QR Code while boarding the bus."

PDF via existing `jspdf` (`src/lib/bus-pass-pdf.ts`) — A5 portrait. "Save as Image" via `html2canvas` of the card div.

### 4. Sidebar — new "Bus Pass" menu (admin/staff only)

Route `src/routes/_authenticated/bus-pass.tsx` with tabs:
- **Issued Passes** — table of all passes, status badges (ACTIVE green / EXPIRED red / FEE PENDING orange / CANCELLED gray), search, filters.
- **Issue / Reissue** — pick a student → preview → Generate (validates fee + active transport server-side).
- **Reports** — Generated, Downloaded, Cancelled, Attendance Summary (daily/monthly). Excel via `xlsx`, PDF via `jspdf`.

Per-row actions: Download PDF, Print, Cancel, Reissue, Regenerate QR, Deactivate. All gated by `has_role(uid,'admin')` policy on `bus_pass`.

### 5. Attendance scanner integration

Extend `attendance.scan.tsx` lookup:
- Look up `bus_pass` by `qr_token` instead of `students.qr_token`.
- Reject with clear messages: cancelled / expired / fee_pending / past validity.
- On success keep current flow (auto trip detection, geolocation, offline queue, duplicate-trip guard, success beep). Add flashlight toggle via `MediaStreamTrack.applyConstraints({advanced:[{torch:true}]})` where supported.

Students profile page — add **Bus Pass** tab next to existing Attendance tab showing current pass + history.

### 6. QR security

- QR payload = `qr_token` (UUID) only. No name/roll/mobile/dept.
- Scanner-side checks expiry/active/fee on every scan (server enforces too via RLS + RPC).
- Cancelling/regenerating rotates `qr_token`; old QR stops working immediately.

### 7. Branding

Use uploaded Thiagarajar Polytechnic logo (upload via lovable-assets → `src/assets/college-logo.png.asset.json`). Used in: public portal header, pass card, PDF, print stylesheet.

### Packages to add
`html2canvas` (Save as Image). `qrcode`, `xlsx`, `jspdf`, `html5-qrcode` already present.

### Out of scope
No changes to existing Students/Fees/Routes/Staff/Maintenance/Requests code paths beyond adding a Bus Pass tab on the student profile and pointing the attendance scanner lookup at `bus_pass`.

### Open question

You mentioned uploading the Thiagarajar Polytechnic College logo, but I don't see it attached to this message. Please upload the logo image (PNG with transparent background preferred) so I can wire it into the pass, portal, and PDF. If you'd like, I can proceed with a placeholder logo and swap it once you upload.
