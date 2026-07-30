CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  number_name TEXT NOT NULL,
  customer_message TEXT,
  flag TEXT NOT NULL DEFAULT 'lead' CHECK (flag IN ('spam','marketing','lead','future_customer','in_progress','done','scheduled','cancelled')),
  linked_lead_id UUID,
  handled_by UUID,
  call_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read calls"
  ON public.calls FOR SELECT TO authenticated USING (true);

CREATE POLICY "CS and Admin can insert calls"
  ON public.calls FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'customer_service'::app_role)
  ));

CREATE POLICY "Owner or Admin can update calls"
  ON public.calls FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Owner or Admin can delete calls"
  ON public.calls FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role));

CREATE INDEX idx_calls_call_date ON public.calls(call_date DESC);
CREATE INDEX idx_calls_flag ON public.calls(flag);
CREATE INDEX idx_calls_direction ON public.calls(direction);

CREATE TRIGGER calls_set_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();