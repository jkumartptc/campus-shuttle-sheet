CREATE TYPE public.driver_type AS ENUM ('bus','car');

ALTER TABLE public.user_roles
  ADD COLUMN driver_type public.driver_type;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_driver_type_only_for_driver
  CHECK (driver_type IS NULL OR role = 'driver');