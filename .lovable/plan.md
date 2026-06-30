## Plan: Public Bus Pass Download Link

The page already exists at `/bus-pass` (route: `src/routes/bus-pass.tsx`). Students enter Register Number + Mobile and get their pass (view / PDF / print / image). No new page needed — only small enhancements so it's actually usable and shareable.

### 1. Make the link easy to share
- Add a "Bus Pass" quick link / button on the public landing page (`src/routes/index.tsx`) pointing to `/bus-pass`.
- Add a "Copy public bus pass link" button in the admin Bus Passes screen (`src/routes/_authenticated/bus-passes.tsx`) so staff can share `https://<site>/bus-pass` with students in one click.

### 2. Align rules with the new attendance policy
Currently `get_bus_pass_public` rejects a student when `paid < total_fee` with `fee_pending`. Since attendance now allows fee-pending passes, downloads should follow the same rule:
- Update the `get_bus_pass_public` SQL function to no longer raise `fee_pending`. Issue/return the pass with `fee_status = 'pending'` when fees aren't fully paid, `pass_status = 'active'`.
- Keep blocking only: student not found, mobile mismatch.
- Frontend already shows the fee badge, so the student sees pending status clearly on the pass.

### 3. UX polish on `/bus-pass`
- Map remaining backend errors to friendlier toasts ("Register number not found", "Mobile number doesn't match our records").
- Trim/normalize register no and mobile inputs before submitting.
- No theme / layout changes.

### Files touched
- `supabase/migrations/<new>.sql` — update `public.get_bus_pass_public`
- `src/routes/bus-pass.tsx` — friendlier error handling, input trim
- `src/routes/index.tsx` — add visible "Download Bus Pass" entry
- `src/routes/_authenticated/bus-passes.tsx` — "Copy public link" button

No other modules affected.
