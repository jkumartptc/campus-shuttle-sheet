
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- New user signup: create profile + auto-assign role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email);

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- timestamp helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ BUSES ============
CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_no text NOT NULL UNIQUE,
  reg_no text,
  driver_name text,
  driver_phone text,
  capacity int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buses TO authenticated;
GRANT ALL ON public.buses TO service_role;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buses_select" ON public.buses FOR SELECT TO authenticated USING (true);
CREATE POLICY "buses_insert" ON public.buses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "buses_update" ON public.buses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "buses_delete_admin" ON public.buses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER buses_updated BEFORE UPDATE ON public.buses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROUTES ============
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes_select" ON public.routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "routes_insert" ON public.routes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "routes_update" ON public.routes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "routes_delete_admin" ON public.routes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER routes_updated BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STOPS ============
CREATE TABLE public.stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  fare numeric(10,2) NOT NULL DEFAULT 0,
  stop_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stops TO authenticated;
GRANT ALL ON public.stops TO service_role;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stops_select" ON public.stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "stops_insert" ON public.stops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stops_update" ON public.stops FOR UPDATE TO authenticated USING (true);
CREATE POLICY "stops_delete_admin" ON public.stops FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER stops_updated BEFORE UPDATE ON public.stops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no text NOT NULL UNIQUE,
  name text NOT NULL,
  department text,
  year text,
  phone text,
  parent_phone text,
  stop_id uuid REFERENCES public.stops(id) ON DELETE SET NULL,
  academic_year text NOT NULL,
  total_fee numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_select" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "students_insert" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "students_update" ON public.students FOR UPDATE TO authenticated USING (true);
CREATE POLICY "students_delete_admin" ON public.students FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PAYMENTS ============
CREATE SEQUENCE public.receipt_no_seq START 1001;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  mode text NOT NULL DEFAULT 'Cash',
  reference text,
  remarks text,
  receipt_no text NOT NULL UNIQUE DEFAULT ('RCPT-' || lpad(nextval('public.receipt_no_seq')::text, 6, '0')),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
GRANT USAGE ON SEQUENCE public.receipt_no_seq TO authenticated;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "payments_delete_admin" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUEL LOGS ============
CREATE TABLE public.fuel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  filled_on date NOT NULL DEFAULT CURRENT_DATE,
  litres numeric(10,2) NOT NULL CHECK (litres > 0),
  rate_per_litre numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  odometer numeric(12,2) NOT NULL,
  station text,
  remarks text,
  mileage_kmpl numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_logs TO authenticated;
GRANT ALL ON public.fuel_logs TO service_role;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_select" ON public.fuel_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fuel_insert" ON public.fuel_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fuel_update" ON public.fuel_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fuel_delete_admin" ON public.fuel_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER fuel_updated BEFORE UPDATE ON public.fuel_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-compute mileage on insert based on previous fill
CREATE OR REPLACE FUNCTION public.compute_fuel_mileage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  prev_odo numeric;
BEGIN
  SELECT odometer INTO prev_odo
  FROM public.fuel_logs
  WHERE bus_id = NEW.bus_id
    AND (filled_on < NEW.filled_on OR (filled_on = NEW.filled_on AND created_at < COALESCE(NEW.created_at, now())))
  ORDER BY filled_on DESC, created_at DESC
  LIMIT 1;

  IF prev_odo IS NOT NULL AND NEW.litres > 0 AND NEW.odometer > prev_odo THEN
    NEW.mileage_kmpl := ROUND(((NEW.odometer - prev_odo) / NEW.litres)::numeric, 2);
  END IF;

  IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
    NEW.total_cost := ROUND((NEW.litres * NEW.rate_per_litre)::numeric, 2);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER fuel_logs_compute BEFORE INSERT ON public.fuel_logs
  FOR EACH ROW EXECUTE FUNCTION public.compute_fuel_mileage();

-- ============ SERVICE LOGS ============
CREATE TABLE public.service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  service_on date NOT NULL DEFAULT CURRENT_DATE,
  service_type text NOT NULL,
  workshop text,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  next_due_on date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_logs TO authenticated;
GRANT ALL ON public.service_logs TO service_role;
ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_select" ON public.service_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_insert" ON public.service_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_update" ON public.service_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_delete_admin" ON public.service_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER service_updated BEFORE UPDATE ON public.service_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
