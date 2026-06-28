
CREATE OR REPLACE FUNCTION public.sync_bus_pass_fee_status(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_paid numeric;
  v_fully_paid boolean;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
  IF v_student.id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE student_id = p_student_id;
  v_fully_paid := (COALESCE(v_student.total_fee,0) > 0 AND v_paid >= v_student.total_fee);

  IF v_fully_paid THEN
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
    ON CONFLICT (student_id) DO UPDATE
      SET fee_status = 'paid',
          pass_status = CASE WHEN public.bus_pass.pass_status IN ('cancelled','expired') THEN public.bus_pass.pass_status ELSE 'active' END,
          updated_at = now();
  ELSE
    UPDATE public.bus_pass
      SET fee_status = 'pending',
          pass_status = CASE WHEN pass_status IN ('cancelled','expired') THEN pass_status ELSE 'fee_pending' END,
          updated_at = now()
      WHERE student_id = p_student_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_payments_sync_bus_pass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_bus_pass_fee_status(OLD.student_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_bus_pass_fee_status(NEW.student_id);
    IF TG_OP = 'UPDATE' AND OLD.student_id <> NEW.student_id THEN
      PERFORM public.sync_bus_pass_fee_status(OLD.student_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_bus_pass ON public.payments;
CREATE TRIGGER payments_sync_bus_pass
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payments_sync_bus_pass();

-- Backfill all students
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.students LOOP
    PERFORM public.sync_bus_pass_fee_status(r.id);
  END LOOP;
END $$;
