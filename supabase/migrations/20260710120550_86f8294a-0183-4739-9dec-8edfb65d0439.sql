
DROP VIEW IF EXISTS public.vehicle_dashboard;
CREATE VIEW public.vehicle_dashboard WITH (security_invoker=on) AS
WITH latest_odo AS (
  SELECT DISTINCT ON (odometer_logs.vehicle_id) odometer_logs.vehicle_id,
    odometer_logs.reading_km AS current_odo,
    odometer_logs.logged_at AS last_odo_at
  FROM odometer_logs
  ORDER BY odometer_logs.vehicle_id, odometer_logs.logged_at DESC
), latest_fuel AS (
  SELECT DISTINCT ON (fuel_logs.vehicle_id) fuel_logs.vehicle_id,
    fuel_logs.filled_on AS last_fuel_date,
    fuel_logs.odometer AS last_fuel_odo
  FROM fuel_logs
  WHERE fuel_logs.vehicle_id IS NOT NULL
  ORDER BY fuel_logs.vehicle_id, fuel_logs.filled_on DESC, fuel_logs.created_at DESC
), avg_mileage AS (
  SELECT t.vehicle_id, round(avg(t.mileage_kmpl), 2) AS avg_mileage_kmpl
  FROM (SELECT fuel_logs.vehicle_id, fuel_logs.mileage_kmpl,
          row_number() OVER (PARTITION BY fuel_logs.vehicle_id ORDER BY fuel_logs.filled_on DESC) AS rn
        FROM fuel_logs
        WHERE fuel_logs.vehicle_id IS NOT NULL AND fuel_logs.mileage_kmpl IS NOT NULL) t
  WHERE t.rn <= 5
  GROUP BY t.vehicle_id
), month_fuel AS (
  SELECT fuel_logs.vehicle_id, sum(fuel_logs.litres) AS month_litres, sum(fuel_logs.total_cost) AS month_cost
  FROM fuel_logs
  WHERE fuel_logs.vehicle_id IS NOT NULL AND fuel_logs.filled_on >= date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)
  GROUP BY fuel_logs.vehicle_id
), next_svc AS (
  SELECT DISTINCT ON (service_schedules.vehicle_id) service_schedules.vehicle_id,
    service_schedules.item AS next_service_item, service_schedules.next_due_on AS next_service_due
  FROM service_schedules
  WHERE service_schedules.next_due_on IS NOT NULL
  ORDER BY service_schedules.vehicle_id, service_schedules.next_due_on
), doc_expiry AS (
  SELECT vehicle_documents.vehicle_id,
    max(CASE WHEN vehicle_documents.doc_type = 'insurance' THEN vehicle_documents.expires_on END) AS insurance_expiry,
    max(CASE WHEN vehicle_documents.doc_type = 'fc' THEN vehicle_documents.expires_on END) AS fc_expiry,
    max(CASE WHEN vehicle_documents.doc_type = 'permit' THEN vehicle_documents.expires_on END) AS permit_expiry,
    max(CASE WHEN vehicle_documents.doc_type = 'puc' THEN vehicle_documents.expires_on END) AS puc_expiry
  FROM vehicle_documents
  WHERE vehicle_documents.is_current
  GROUP BY vehicle_documents.vehicle_id
)
SELECT v.id, v.name, v.reg_no, v.category, v.status,
  lo.current_odo, lo.last_odo_at,
  lf.last_fuel_date, lf.last_fuel_odo,
  COALESCE(lo.current_odo - lf.last_fuel_odo, 0::numeric) AS km_since_last_fuel,
  am.avg_mileage_kmpl,
  COALESCE(mf.month_litres, 0::numeric) AS month_litres,
  COALESCE(mf.month_cost, 0::numeric) AS month_cost,
  ns.next_service_item, ns.next_service_due,
  de.insurance_expiry, de.fc_expiry, de.permit_expiry, de.puc_expiry
FROM vehicle_master v
  LEFT JOIN latest_odo lo ON lo.vehicle_id = v.id
  LEFT JOIN latest_fuel lf ON lf.vehicle_id = v.id
  LEFT JOIN avg_mileage am ON am.vehicle_id = v.id
  LEFT JOIN month_fuel mf ON mf.vehicle_id = v.id
  LEFT JOIN next_svc ns ON ns.vehicle_id = v.id
  LEFT JOIN doc_expiry de ON de.vehicle_id = v.id;

GRANT SELECT ON public.vehicle_dashboard TO authenticated;

ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_payments_sync_bus_pass() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_bus_pass_fee_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_bus_pass_download(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_bus_pass_qr(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_bus_pass_public(text, text) FROM authenticated;

DROP POLICY IF EXISTS buses_insert ON public.buses;
DROP POLICY IF EXISTS buses_update ON public.buses;
CREATE POLICY buses_insert ON public.buses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY buses_update ON public.buses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS routes_insert ON public.routes;
DROP POLICY IF EXISTS routes_update ON public.routes;
CREATE POLICY routes_insert ON public.routes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY routes_update ON public.routes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS stops_insert ON public.stops;
DROP POLICY IF EXISTS stops_update ON public.stops;
CREATE POLICY stops_insert ON public.stops FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY stops_update ON public.stops FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS students_insert ON public.students;
DROP POLICY IF EXISTS students_update ON public.students;
CREATE POLICY students_insert ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY students_update ON public.students FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'accounts'));
CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'accounts'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'accounts'));

DROP POLICY IF EXISTS fuel_insert ON public.fuel_logs;
DROP POLICY IF EXISTS fuel_update ON public.fuel_logs;
CREATE POLICY fuel_insert ON public.fuel_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'driver'));
CREATE POLICY fuel_update ON public.fuel_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS service_insert ON public.service_logs;
DROP POLICY IF EXISTS service_update ON public.service_logs;
CREATE POLICY service_insert ON public.service_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY service_update ON public.service_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "Anyone can submit a request" ON public.transport_requests;
DROP POLICY IF EXISTS "Staff can update requests" ON public.transport_requests;
DROP POLICY IF EXISTS "Staff can delete requests" ON public.transport_requests;
CREATE POLICY "Anyone can submit a request" ON public.transport_requests FOR INSERT TO anon, authenticated
  WITH CHECK (name IS NOT NULL AND length(btrim(name)) > 0 AND register_no IS NOT NULL AND length(btrim(register_no)) > 0);
CREATE POLICY "Staff can update requests" ON public.transport_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "Staff can delete requests" ON public.transport_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS vm_insert ON public.vehicle_master;
DROP POLICY IF EXISTS vm_update ON public.vehicle_master;
CREATE POLICY vm_insert ON public.vehicle_master FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY vm_update ON public.vehicle_master FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS mr_insert ON public.maintenance_records;
DROP POLICY IF EXISTS mr_update ON public.maintenance_records;
CREATE POLICY mr_insert ON public.maintenance_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'driver'));
CREATE POLICY mr_update ON public.maintenance_records FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS odo_insert ON public.odometer_logs;
DROP POLICY IF EXISTS odo_update ON public.odometer_logs;
CREATE POLICY odo_insert ON public.odometer_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'driver'));
CREATE POLICY odo_update ON public.odometer_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
