
-- Seed fleet vehicles
INSERT INTO public.vehicle_master (name, reg_no, category, usage, campus_only, status)
SELECT * FROM (VALUES
  ('College Bus', 'TN11Z4470', 'Bus', 'Student Transport', false, 'active'),
  ('Mahindra XUV-500', 'KMKA7585', 'Car', 'Official Use', false, 'active'),
  ('Jeep Compass', 'KA02MN4181', 'Car', 'Official Use', false, 'active')
) AS v(name, reg_no, category, usage, campus_only, status)
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_master vm WHERE vm.reg_no = v.reg_no);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_master_reg_no_uniq
  ON public.vehicle_master (reg_no) WHERE reg_no IS NOT NULL;

-- Extend vehicle_master
ALTER TABLE public.vehicle_master
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS make text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS year int,
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS notes text;

-- Extend fuel_logs
ALTER TABLE public.fuel_logs
  ADD COLUMN IF NOT EXISTS bill_no text,
  ADD COLUMN IF NOT EXISTS fuel_station text DEFAULT 'Five Roads Fuel Service Station',
  ADD COLUMN IF NOT EXISTS credit_purchase boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invoice_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS logged_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.fuel_logs
    ADD CONSTRAINT fuel_logs_payment_status_check
    CHECK (payment_status IN ('pending','billed','paid'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Odometer logs
CREATE TABLE IF NOT EXISTS public.odometer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicle_master(id) ON DELETE CASCADE,
  reading_km numeric(12,2) NOT NULL CHECK (reading_km >= 0),
  driver_id uuid,
  remarks text,
  distance_km numeric(12,2),
  anomaly boolean NOT NULL DEFAULT false,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_odo_vehicle_time ON public.odometer_logs(vehicle_id, logged_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.odometer_logs TO authenticated;
GRANT ALL ON public.odometer_logs TO service_role;
ALTER TABLE public.odometer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "odo_select" ON public.odometer_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "odo_insert" ON public.odometer_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "odo_update" ON public.odometer_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "odo_delete" ON public.odometer_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.compute_odometer_log()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  prev_reading numeric;
  recent_dup int;
  median_daily numeric;
BEGIN
  IF NEW.logged_at IS NULL THEN NEW.logged_at := now(); END IF;

  SELECT count(*) INTO recent_dup FROM public.odometer_logs
    WHERE vehicle_id = NEW.vehicle_id
      AND id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)
      AND logged_at > NEW.logged_at - interval '2 minutes'
      AND logged_at <= NEW.logged_at;
  IF recent_dup > 0 THEN
    RAISE EXCEPTION 'duplicate_odometer: another entry exists within 2 minutes' USING ERRCODE='P0001';
  END IF;

  SELECT reading_km INTO prev_reading
    FROM public.odometer_logs
    WHERE vehicle_id = NEW.vehicle_id
      AND id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)
      AND logged_at < NEW.logged_at
    ORDER BY logged_at DESC LIMIT 1;

  IF prev_reading IS NOT NULL THEN
    IF NEW.reading_km <= prev_reading THEN
      RAISE EXCEPTION 'odometer_must_increase: current % must be greater than previous %',
        NEW.reading_km, prev_reading USING ERRCODE='P0001';
    END IF;
    NEW.distance_km := NEW.reading_km - prev_reading;

    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY distance_km)
      INTO median_daily
      FROM public.odometer_logs
      WHERE vehicle_id = NEW.vehicle_id
        AND distance_km IS NOT NULL
        AND logged_at > now() - interval '30 days';
    IF median_daily IS NOT NULL AND median_daily > 0
       AND NEW.distance_km > median_daily * 3 THEN
      NEW.anomaly := true;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS odo_compute ON public.odometer_logs;
CREATE TRIGGER odo_compute BEFORE INSERT OR UPDATE ON public.odometer_logs
  FOR EACH ROW EXECUTE FUNCTION public.compute_odometer_log();

DROP TRIGGER IF EXISTS odo_updated ON public.odometer_logs;
CREATE TRIGGER odo_updated BEFORE UPDATE ON public.odometer_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vehicle documents
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicle_master(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('insurance','fc','permit','puc','rc','other')),
  doc_no text,
  provider text,
  issued_on date,
  expires_on date,
  file_url text,
  notes text,
  is_current boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_vehicle_type ON public.vehicle_documents(vehicle_id, doc_type, expires_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vd_select" ON public.vehicle_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "vd_insert" ON public.vehicle_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "vd_update" ON public.vehicle_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "vd_delete" ON public.vehicle_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS vd_updated ON public.vehicle_documents;
CREATE TRIGGER vd_updated BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service schedules
CREATE TABLE IF NOT EXISTS public.service_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicle_master(id) ON DELETE CASCADE,
  item text NOT NULL,
  interval_km int,
  interval_days int,
  last_done_on date,
  last_done_km numeric(12,2),
  next_due_on date,
  next_due_km numeric(12,2),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sched_vehicle ON public.service_schedules(vehicle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_schedules TO authenticated;
GRANT ALL ON public.service_schedules TO service_role;
ALTER TABLE public.service_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_select" ON public.service_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "ss_insert" ON public.service_schedules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "ss_update" ON public.service_schedules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "ss_delete" ON public.service_schedules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS ss_updated ON public.service_schedules;
CREATE TRIGGER ss_updated BEFORE UPDATE ON public.service_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tyres
CREATE TABLE IF NOT EXISTS public.tyres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicle_master(id) ON DELETE CASCADE,
  position text,
  brand text,
  serial_no text,
  fitted_on date,
  fitted_km numeric(12,2),
  removed_on date,
  removed_km numeric(12,2),
  cost numeric(12,2),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tyres_vehicle ON public.tyres(vehicle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tyres TO authenticated;
GRANT ALL ON public.tyres TO service_role;
ALTER TABLE public.tyres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ty_select" ON public.tyres FOR SELECT TO authenticated USING (true);
CREATE POLICY "ty_insert" ON public.tyres FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "ty_update" ON public.tyres FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "ty_delete" ON public.tyres FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS ty_updated ON public.tyres;
CREATE TRIGGER ty_updated BEFORE UPDATE ON public.tyres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dashboard view
CREATE OR REPLACE VIEW public.vehicle_dashboard AS
WITH latest_odo AS (
  SELECT DISTINCT ON (vehicle_id) vehicle_id, reading_km AS current_odo, logged_at AS last_odo_at
  FROM public.odometer_logs ORDER BY vehicle_id, logged_at DESC
),
latest_fuel AS (
  SELECT DISTINCT ON (vehicle_id) vehicle_id, filled_on AS last_fuel_date, odometer AS last_fuel_odo
  FROM public.fuel_logs WHERE vehicle_id IS NOT NULL ORDER BY vehicle_id, filled_on DESC, created_at DESC
),
avg_mileage AS (
  SELECT vehicle_id, ROUND(AVG(mileage_kmpl)::numeric, 2) AS avg_mileage_kmpl
  FROM (
    SELECT vehicle_id, mileage_kmpl,
      ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY filled_on DESC) rn
    FROM public.fuel_logs WHERE vehicle_id IS NOT NULL AND mileage_kmpl IS NOT NULL
  ) t WHERE rn <= 5 GROUP BY vehicle_id
),
month_fuel AS (
  SELECT vehicle_id,
    SUM(litres) AS month_litres,
    SUM(total_cost) AS month_cost
  FROM public.fuel_logs
  WHERE vehicle_id IS NOT NULL
    AND filled_on >= date_trunc('month', CURRENT_DATE)
  GROUP BY vehicle_id
),
next_svc AS (
  SELECT DISTINCT ON (vehicle_id) vehicle_id, item AS next_service_item, next_due_on AS next_service_due
  FROM public.service_schedules
  WHERE next_due_on IS NOT NULL
  ORDER BY vehicle_id, next_due_on ASC
),
doc_expiry AS (
  SELECT vehicle_id,
    MAX(CASE WHEN doc_type='insurance' THEN expires_on END) AS insurance_expiry,
    MAX(CASE WHEN doc_type='fc' THEN expires_on END) AS fc_expiry,
    MAX(CASE WHEN doc_type='permit' THEN expires_on END) AS permit_expiry,
    MAX(CASE WHEN doc_type='puc' THEN expires_on END) AS puc_expiry
  FROM public.vehicle_documents WHERE is_current GROUP BY vehicle_id
)
SELECT v.id, v.name, v.reg_no, v.category, v.status,
  lo.current_odo, lo.last_odo_at,
  lf.last_fuel_date, lf.last_fuel_odo,
  COALESCE(lo.current_odo - lf.last_fuel_odo, 0) AS km_since_last_fuel,
  am.avg_mileage_kmpl,
  COALESCE(mf.month_litres, 0) AS month_litres,
  COALESCE(mf.month_cost, 0) AS month_cost,
  ns.next_service_item, ns.next_service_due,
  de.insurance_expiry, de.fc_expiry, de.permit_expiry, de.puc_expiry
FROM public.vehicle_master v
LEFT JOIN latest_odo lo ON lo.vehicle_id = v.id
LEFT JOIN latest_fuel lf ON lf.vehicle_id = v.id
LEFT JOIN avg_mileage am ON am.vehicle_id = v.id
LEFT JOIN month_fuel mf ON mf.vehicle_id = v.id
LEFT JOIN next_svc ns ON ns.vehicle_id = v.id
LEFT JOIN doc_expiry de ON de.vehicle_id = v.id;

GRANT SELECT ON public.vehicle_dashboard TO authenticated;

-- Storage policies for vehicle-docs bucket (bucket created via tool)
DROP POLICY IF EXISTS "vdoc_read" ON storage.objects;
CREATE POLICY "vdoc_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-docs');
DROP POLICY IF EXISTS "vdoc_write" ON storage.objects;
CREATE POLICY "vdoc_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));
DROP POLICY IF EXISTS "vdoc_update" ON storage.objects;
CREATE POLICY "vdoc_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')));
DROP POLICY IF EXISTS "vdoc_delete" ON storage.objects;
CREATE POLICY "vdoc_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-docs' AND public.has_role(auth.uid(),'admin'));
