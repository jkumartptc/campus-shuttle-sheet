
CREATE TABLE public.vehicle_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  reg_no text,
  category text NOT NULL,
  usage text,
  campus_only boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  last_service_date date,
  next_service_date date,
  next_service_km integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_master TO authenticated;
GRANT ALL ON public.vehicle_master TO service_role;
ALTER TABLE public.vehicle_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY vm_select ON public.vehicle_master FOR SELECT TO authenticated USING (true);
CREATE POLICY vm_insert ON public.vehicle_master FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vm_update ON public.vehicle_master FOR UPDATE TO authenticated USING (true);
CREATE POLICY vm_delete ON public.vehicle_master FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER vm_updated BEFORE UPDATE ON public.vehicle_master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicle_master(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  odometer integer,
  maintenance_type text NOT NULL,
  description text,
  workshop text,
  invoice_no text,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  next_service_date date,
  next_service_km integer,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_records TO authenticated;
GRANT ALL ON public.maintenance_records TO service_role;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_select ON public.maintenance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY mr_insert ON public.maintenance_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY mr_update ON public.maintenance_records FOR UPDATE TO authenticated USING (true);
CREATE POLICY mr_delete ON public.maintenance_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX mr_vehicle_idx ON public.maintenance_records(vehicle_id, service_date DESC);
CREATE TRIGGER mr_updated BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vehicle_master (name, reg_no, category, usage, campus_only) VALUES
  ('College Bus', 'TN11Z4470', 'Bus', 'Student Transport', false),
  ('Mahindra XUV500', 'KMKA7585', 'Car', 'Official', false),
  ('Jeep Compass', 'KA02MN4181', 'Car', 'Official', false),
  ('Ford EcoSport Demo-01', NULL, 'Demo Vehicle', 'Industry Sponsored Demo Vehicle', true),
  ('Ford EcoSport Demo-02', NULL, 'Demo Vehicle', 'Industry Sponsored Demo Vehicle', true),
  ('Hyundai Sonata Demo', NULL, 'Demo Vehicle', 'Industry Sponsored Demo Vehicle', true);
