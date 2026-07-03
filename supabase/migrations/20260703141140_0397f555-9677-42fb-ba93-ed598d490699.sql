CREATE OR REPLACE FUNCTION public.get_bus_pass_public(p_register_no text, p_mobile text)
 RETURNS TABLE(pass_id text, qr_token uuid, pass_status text, fee_status text, valid_from date, valid_to date, academic_year text, boarding_point text, bus_number text, route_name text, student_id uuid, student_name text, roll_no text, department text, year text, phone text, photo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_student public.students%ROWTYPE;
  v_paid numeric;
  v_fee text;
BEGIN
  SELECT s.* INTO v_student FROM public.students s WHERE s.roll_no = p_register_no LIMIT 1;
  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_student.phone,'') <> COALESCE(p_mobile,'') AND COALESCE(v_student.parent_phone,'') <> COALESCE(p_mobile,'') THEN
    RAISE EXCEPTION 'mobile_mismatch' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(p.amount),0) INTO v_paid FROM public.payments p WHERE p.student_id = v_student.id;
  v_fee := CASE WHEN COALESCE(v_student.total_fee,0) > 0 AND v_paid >= v_student.total_fee THEN 'paid' ELSE 'pending' END;

  INSERT INTO public.bus_pass AS bp (student_id, pass_id, fee_status, pass_status, academic_year, boarding_point, bus_number, route_id)
  SELECT v_student.id,
    'TPT-' || COALESCE(NULLIF(v_student.academic_year,''),EXTRACT(YEAR FROM CURRENT_DATE)::text) || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text,'-','') FROM 1 FOR 8)),
    v_fee,'active', v_student.academic_year,
    st_s.name, b.bus_no, r.id
  FROM public.students st
    LEFT JOIN public.stops st_s ON st_s.id = st.stop_id
    LEFT JOIN public.routes r ON r.id = st_s.route_id
    LEFT JOIN public.buses b ON b.id = r.bus_id
  WHERE st.id = v_student.id
  ON CONFLICT (student_id) DO UPDATE
    SET fee_status = EXCLUDED.fee_status,
        pass_status = CASE WHEN bp.pass_status IN ('cancelled','expired') THEN bp.pass_status ELSE 'active' END,
        updated_at = now();

  RETURN QUERY
  SELECT bp.pass_id, bp.qr_token, bp.pass_status, bp.fee_status, bp.valid_from, bp.valid_to, bp.academic_year,
         bp.boarding_point, bp.bus_number, r.name,
         v_student.id, v_student.name, v_student.roll_no, v_student.department, v_student.year,
         v_student.phone, v_student.photo_url
  FROM public.bus_pass bp
  LEFT JOIN public.routes r ON r.id = bp.route_id
  WHERE bp.student_id = v_student.id;
END;
$function$;