CREATE TABLE public.lead_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL,
  shared_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(lead_id, shared_with_user_id)
);

ALTER TABLE public.lead_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead_shares"
  ON public.lead_shares FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert lead_shares"
  ON public.lead_shares FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lead_shares"
  ON public.lead_shares FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));