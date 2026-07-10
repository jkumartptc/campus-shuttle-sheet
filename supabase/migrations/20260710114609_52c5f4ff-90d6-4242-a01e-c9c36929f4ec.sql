
ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_payment_mode_check;
ALTER TABLE public.fuel_logs ADD CONSTRAINT fuel_logs_payment_mode_check CHECK (payment_mode IS NULL OR payment_mode = ANY (ARRAY['cash','card','upi','credit']));
ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_litres_check;
ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_positive_litres;
ALTER TABLE public.fuel_logs ADD CONSTRAINT fuel_logs_litres_check CHECK (litres >= 0);
ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_positive_rate;
ALTER TABLE public.fuel_logs ADD CONSTRAINT fuel_logs_rate_check CHECK (rate_per_litre >= 0);
