
CREATE TABLE IF NOT EXISTS public.lead_payment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  requested_by UUID NOT NULL,
  requested_by_role TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  screenshot_path TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_payment_requests_lead_id_idx ON public.lead_payment_requests(lead_id);
CREATE INDEX IF NOT EXISTS lead_payment_requests_status_idx ON public.lead_payment_requests(status);

GRANT SELECT, INSERT, UPDATE ON public.lead_payment_requests TO authenticated;
GRANT ALL ON public.lead_payment_requests TO service_role;

ALTER TABLE public.lead_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read payment requests"
  ON public.lead_payment_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Processor admin can create own payment requests"
  ON public.lead_payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      (requested_by_role = 'processor' AND public.has_role(auth.uid(), 'processor'::public.app_role))
      OR (requested_by_role = 'admin' AND public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

CREATE POLICY "Admins can review payment requests"
  ON public.lead_payment_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_lead_payment_requests_updated_at
  BEFORE UPDATE ON public.lead_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_payment_requests;
