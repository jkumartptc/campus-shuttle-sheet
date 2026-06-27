
CREATE TABLE public.transport_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  register_no TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  mobile TEXT NOT NULL,
  father_name TEXT NOT NULL,
  father_mobile TEXT NOT NULL,
  bus_stop_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.transport_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_requests TO authenticated;
GRANT ALL ON public.transport_requests TO service_role;

ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a request"
  ON public.transport_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view requests"
  ON public.transport_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can update requests"
  ON public.transport_requests FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Staff can delete requests"
  ON public.transport_requests FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER update_transport_requests_updated_at
  BEFORE UPDATE ON public.transport_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
