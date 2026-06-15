-- Cancellation approval workflow
-- CS cancellation requests can be approved/rejected by Processor or Admin.
-- Processor cancellation requests can be approved/rejected only by Admin.

CREATE TABLE IF NOT EXISTS public.lead_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by_role TEXT NOT NULL CHECK (requested_by_role IN ('customer_service', 'processor', 'admin')),
  comment TEXT NOT NULL,
  proof TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_cancellation_requests_lead_status
  ON public.lead_cancellation_requests (lead_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS one_pending_cancellation_request_per_lead
  ON public.lead_cancellation_requests (lead_id)
  WHERE status = 'pending';

ALTER TABLE public.lead_cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cancellation requests"
  ON public.lead_cancellation_requests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "CS processor admin can create own cancellation requests"
  ON public.lead_cancellation_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      (requested_by_role = 'customer_service' AND has_role(auth.uid(), 'customer_service'::app_role))
      OR (requested_by_role = 'processor' AND has_role(auth.uid(), 'processor'::app_role))
      OR (requested_by_role = 'admin' AND has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Approvers can review cancellation requests"
  ON public.lead_cancellation_requests FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'processor'::app_role)
      AND requested_by_role = 'customer_service'
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'processor'::app_role)
      AND requested_by_role = 'customer_service'
    )
  );

DROP TRIGGER IF EXISTS lead_cancellation_requests_set_updated_at ON public.lead_cancellation_requests;
CREATE TRIGGER lead_cancellation_requests_set_updated_at
  BEFORE UPDATE ON public.lead_cancellation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
