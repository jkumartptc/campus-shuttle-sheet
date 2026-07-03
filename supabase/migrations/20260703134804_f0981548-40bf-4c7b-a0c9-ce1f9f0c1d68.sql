
ALTER TABLE public.fuel_logs
  ADD COLUMN IF NOT EXISTS indent_number text,
  ADD COLUMN IF NOT EXISTS fuel_type text CHECK (fuel_type IN ('petrol','diesel')),
  ADD COLUMN IF NOT EXISTS driver text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_logs_indent_unique
  ON public.fuel_logs (indent_number)
  WHERE indent_number IS NOT NULL;
