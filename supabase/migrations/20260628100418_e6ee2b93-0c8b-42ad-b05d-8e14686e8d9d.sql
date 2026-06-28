
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS qr_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS students_qr_token_key ON public.students(qr_token);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  attendance_time timestamptz NOT NULL DEFAULT now(),
  trip text NOT NULL CHECK (trip IN ('morning','evening')),
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  device_name text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_unique_trip_idx ON public.attendance(student_id, attendance_date, trip);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON public.attendance(attendance_date);
CREATE INDEX IF NOT EXISTS attendance_route_idx ON public.attendance(route_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_authenticated" ON public.attendance
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "attendance_insert_staff_driver_admin" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'driver')
  );

CREATE POLICY "attendance_update_admin" ON public.attendance
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "attendance_delete_admin" ON public.attendance
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
