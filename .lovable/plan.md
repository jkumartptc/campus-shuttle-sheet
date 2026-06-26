
# College Transport Management App

A simple admin app for you and other transport staff to manage students, bus stops/routes, transport fees, and **bus maintenance** (diesel & mileage).

## What you'll get

**1. Login (staff only)**
- Email + password sign-in via Lovable Cloud.
- First user becomes admin; admins can promote other staff. No public signup.

**2. Buses, Routes & Stops**
- Add/edit/delete **buses** (bus number, registration no, driver name, driver phone, capacity).
- Add/edit/delete routes (e.g. "Route 1 - North City") and assign a bus to each.
- Add stops under each route, each with its own **fare amount** (since fees vary by stop/distance).

**3. Students**
- Fields: Name, Roll No, Department, Year, Phone, Parent Phone, Route, Stop, Academic Year.
- Annual transport fee auto-filled from the chosen stop (editable).
- Search & filter by name, roll no, route, or payment status (Paid / Partial / Pending).

**4. Fee Payments**
- Record payment: amount, date, mode (Cash / UPI / Bank), reference no, remarks.
- Student page shows Total Fee, Paid, **Balance**, and full payment history.
- Edit/delete a payment if entered wrong.

**5. PDF Receipts**
- After saving a payment, "Download Receipt" → PDF with college header, student details, route/stop, amount paid, balance, date, receipt no, signature line.

**6. Bus Maintenance (Diesel & Mileage)**
- **Diesel/fuel log** per bus: date, litres, rate/litre, total cost, odometer reading, filling station, remarks.
- **Mileage auto-calculated** between two consecutive fills: `(new odo − last odo) ÷ litres of new fill` → shown as km/L.
- **Service/repair log** per bus: date, type (oil change, tyre, brake, general service…), workshop, cost, next-service-due date, remarks.
- Per-bus summary: total km this month, total diesel cost, average mileage, last service date, upcoming service alert.

**7. Dashboard**
- Total students using transport
- Total fee expected (current academic year), Total collected, Total pending
- Students per route
- This month's **diesel spend** and **average mileage per bus**
- Recent payments + recent fuel entries

## Pages

```text
/login                      Staff sign-in
/                           Dashboard
/students                   List + search + add
/students/$id               Detail + payments + receipts
/routes                     Routes & stops (with fares)
/buses                      Buses list
/buses/$id                  Bus detail: fuel log, mileage, service log
/staff                      Admin-only: invite/promote staff
```

## Data model (technical)

- `buses` — id, bus_no, reg_no, driver_name, driver_phone, capacity
- `routes` — id, name, bus_id, notes
- `stops` — id, route_id, name, fare, order
- `students` — id, roll_no (unique), name, department, year, phone, parent_phone, stop_id, academic_year, total_fee
- `payments` — id, student_id, amount, paid_on, mode, reference, remarks, receipt_no, recorded_by
- `fuel_logs` — id, bus_id, filled_on, litres, rate_per_litre, total_cost, odometer, station, mileage_kmpl (computed on insert from previous odo+litres), remarks
- `service_logs` — id, bus_id, service_on, type, workshop, cost, next_due_on, remarks
- `profiles` — id (auth user), full_name
- `user_roles` — user_id, role ('admin' | 'staff') — separate table for security
- `balance` = `total_fee − SUM(payments.amount)` (computed in UI)
- RLS: authenticated staff read/write; only admins manage staff and delete records.

## Out of scope (ask if you want it later)
- Student-facing login, SMS/email fee reminders, online payment gateway, GPS bus tracking, student attendance on bus.

Approve to start building.
