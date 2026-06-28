
-- Bus Pass table
CREATE TABLE public.bus_pass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  pass_id text NOT NULL UNIQUE,
  qr_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  boarding_point text,
  bus_number text,
  fee_status text NOT NULL DEFAULT 'pending',
  pass_status text NOT NULL DEFAULT 'active',
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  academic_year text,
  download_count int NOT NULL DEFAULT 0,
  last_download timestamptz,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_pass TO authenticated;
GRANT ALL ON public.bus_pass TO service_role;

ALTER TABLE public.bus_pass ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read bus_pass" ON public.bus_pass FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/staff insert bus_pass" ON public.bus_pass FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin/staff update bus_pass" ON public.bus_pass FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin delete bus_pass" ON public.bus_pass FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_bus_pass_updated BEFORE UPDATE ON public.bus_pass
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public RPC: lookup by register no + mobile, only when fee paid
CREATE OR REPLACE FUNCTION public.get_bus_pass_public(p_register_no text, p_mobile text)
RETURNS TABLE (
  pass_id text,
  qr_token uuid,
  pass_status text,
  fee_status text,
  valid_from date,
  valid_to date,
  academic_year text,
  boarding_point text,
  bus_number text,
  route_name text,
  student_id uuid,
  student_name text,
  roll_no text,
  department text,
  year text,
  phone text,
  photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_paid numeric;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE roll_no = p_register_no LIMIT 1;
  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_student.phone,'') <> COALESCE(p_mobile,'') AND COALESCE(v_student.parent_phone,'') <> COALESCE(p_mobile,'') THEN
    RAISE EXCEPTION 'mobile_mismatch' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE student_id = v_student.id;
  IF v_paid < COALESCE(v_student.total_fee,0) OR COALESCE(v_student.total_fee,0) = 0 THEN
    RAISE EXCEPTION 'fee_pending' USING ERRCODE = 'P0001';
  END IF;

  -- Ensure a bus_pass row exists for this student
  INSERT INTO public.bus_pass (student_id, pass_id, fee_status, pass_status, academic_year, boarding_point, bus_number, route_id)
  SELECT v_student.id,
    'TPT-' || COALESCE(NULLIF(v_student.academic_year,''),EXTRACT(YEAR FROM CURRENT_DATE)::text) || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text,'-','') FROM 1 FOR 8)),
    'paid','active', v_student.academic_year,
    s.name, b.bus_no, r.id
  FROM public.students st
    LEFT JOIN public.stops s ON s.id = st.stop_id
    LEFT JOIN public.routes r ON r.id = s.route_id
    LEFT JOIN public.buses b ON b.id = r.bus_id
  WHERE st.id = v_student.id
  ON CONFLICT (student_id) DO UPDATE SET fee_status = 'paid', updated_at = now();

  RETURN QUERY
  SELECT bp.pass_id, bp.qr_token, bp.pass_status, bp.fee_status, bp.valid_from, bp.valid_to, bp.academic_year,
         bp.boarding_point, bp.bus_number, r.name,
         v_student.id, v_student.name, v_student.roll_no, v_student.department, v_student.year,
         v_student.phone, v_student.photo_url
  FROM public.bus_pass bp
  LEFT JOIN public.routes r ON r.id = bp.route_id
  WHERE bp.student_id = v_student.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bus_pass_public(text,text) TO anon, authenticated;

-- Public RPC: increment download counter
CREATE OR REPLACE FUNCTION public.bump_bus_pass_download(p_qr_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bus_pass SET download_count = download_count + 1, last_download = now() WHERE qr_token = p_qr_token;
$$;
GRANT EXECUTE ON FUNCTION public.bump_bus_pass_download(uuid) TO anon, authenticated;

-- Scanner-side resolution RPC (returns student + pass status for a QR token)
CREATE OR REPLACE FUNCTION public.resolve_bus_pass_qr(p_qr_token uuid)
RETURNS TABLE (
  student_id uuid, student_name text, roll_no text, department text,
  photo_url text, pass_status text, fee_status text, valid_to date,
  route_id uuid, route_name text, stop_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT st.id, st.name, st.roll_no, st.department, st.photo_url,
         bp.pass_status, bp.fee_status, bp.valid_to,
         r.id, r.name, s.name
  FROM public.bus_pass bp
  JOIN public.students st ON st.id = bp.student_id
  LEFT JOIN public.stops s ON s.id = st.stop_id
  LEFT JOIN public.routes r ON r.id = bp.route_id
  WHERE bp.qr_token = p_qr_token;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_bus_pass_qr(uuid) TO authenticated;
