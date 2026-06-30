## Plan

1. **Reproduce the failing scan path**
   - Use one of the recently issued bus pass QR tokens that is currently stored as `fee_pending`.
   - Confirm whether the scanner still blocks it, where the message is coming from, and whether attendance is inserted.

2. **Fix scanner acceptance rules**
   - Update Bus Attendance QR validation so `fee_pending` passes are treated as usable for attendance.
   - Only block truly unusable passes: invalid QR, cancelled pass, expired pass, or date validity expired.
   - Normalize status casing/spacing so values like `Fee Pending`, `FEE_PENDING`, or `fee_pending` do not trigger a false “not active” result.

3. **Align backend status logic if needed**
   - If the database helper still returns or enforces old “active only” behavior, update it so issued-but-fee-pending passes resolve correctly for scanner use.
   - Keep fee status visible as a warning, not a blocker.

4. **Verify end-to-end**
   - Scan/test with a `fee_pending` pass and confirm attendance is marked with a warning beep/message.
   - Test cancelled/expired/invalid QR still fail.
   - Confirm duplicate attendance still shows the duplicate warning and does not insert another record.