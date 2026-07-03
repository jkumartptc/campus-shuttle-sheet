
-- 1. Add columns to fuel_logs
ALTER TABLE public.fuel_logs
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicle_master(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS payment_mode text CHECK (payment_mode IN ('cash','card','upi')),
  ADD COLUMN IF NOT EXISTS filled_by text;

-- bus_id becomes optional (vehicle_id is the new canonical link)
ALTER TABLE public.fuel_logs ALTER COLUMN bus_id DROP NOT NULL;

-- 2. Backfill vehicle_id from bus reg_no -> vehicle_master.reg_no
UPDATE public.fuel_logs fl
SET vehicle_id = vm.id
FROM public.buses b
JOIN public.vehicle_master vm ON UPPER(REPLACE(vm.reg_no,' ','')) = UPPER(REPLACE(b.reg_no,' ',''))
WHERE fl.bus_id = b.id AND fl.vehicle_id IS NULL;

-- 3. Basic value validations
ALTER TABLE public.fuel_logs
  DROP CONSTRAINT IF EXISTS fuel_logs_positive_litres,
  DROP CONSTRAINT IF EXISTS fuel_logs_positive_rate;
ALTER TABLE public.fuel_logs
  ADD CONSTRAINT fuel_logs_positive_litres CHECK (litres > 0),
  ADD CONSTRAINT fuel_logs_positive_rate   CHECK (rate_per_litre > 0);

-- 4. Rewrite mileage trigger to use vehicle_id (fallback bus_id)
CREATE OR REPLACE FUNCTION public.compute_fuel_mileage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  prev_odo numeric;
BEGIN
  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT odometer INTO prev_odo
    FROM public.fuel_logs
    WHERE vehicle_id = NEW.vehicle_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (filled_on < NEW.filled_on OR (filled_on = NEW.filled_on AND created_at < COALESCE(NEW.created_at, now())))
    ORDER BY filled_on DESC, created_at DESC
    LIMIT 1;
  ELSIF NEW.bus_id IS NOT NULL THEN
    SELECT odometer INTO prev_odo
    FROM public.fuel_logs
    WHERE bus_id = NEW.bus_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (filled_on < NEW.filled_on OR (filled_on = NEW.filled_on AND created_at < COALESCE(NEW.created_at, now())))
    ORDER BY filled_on DESC, created_at DESC
    LIMIT 1;
  END IF;

  IF prev_odo IS NOT NULL THEN
    IF NEW.odometer <= prev_odo THEN
      RAISE EXCEPTION 'odometer_must_increase: current % must be greater than previous %', NEW.odometer, prev_odo USING ERRCODE = 'P0001';
    END IF;
    IF NEW.litres > 0 THEN
      NEW.mileage_kmpl := ROUND(((NEW.odometer - prev_odo) / NEW.litres)::numeric, 2);
    END IF;
  END IF;

  IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
    NEW.total_cost := ROUND((NEW.litres * NEW.rate_per_litre)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_compute_fuel_mileage ON public.fuel_logs;
CREATE TRIGGER trg_compute_fuel_mileage
BEFORE INSERT OR UPDATE ON public.fuel_logs
FOR EACH ROW EXECUTE FUNCTION public.compute_fuel_mileage();

-- 5. updated_at trigger (safety)
DROP TRIGGER IF EXISTS trg_fuel_logs_updated_at ON public.fuel_logs;
CREATE TRIGGER trg_fuel_logs_updated_at
BEFORE UPDATE ON public.fuel_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_date ON public.fuel_logs(vehicle_id, filled_on DESC);
