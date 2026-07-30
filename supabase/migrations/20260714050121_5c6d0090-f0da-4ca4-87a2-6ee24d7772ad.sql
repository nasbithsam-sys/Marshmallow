-- CRM Updates broadcast notifications
CREATE TABLE public.crm_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  affected_section text NOT NULL,
  target_roles text[] NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_updates TO authenticated;
GRANT ALL ON public.crm_updates TO service_role;

ALTER TABLE public.crm_updates ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage crm_updates"
  ON public.crm_updates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Authenticated users can read active notifications targeted to their role
CREATE POLICY "Users read active updates for their role"
  ON public.crm_updates FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text = ANY(crm_updates.target_roles)
    )
  );

CREATE INDEX crm_updates_active_idx ON public.crm_updates(is_active, published_at DESC);
CREATE INDEX crm_updates_target_roles_idx ON public.crm_updates USING gin(target_roles);

CREATE TRIGGER crm_updates_set_updated_at
  BEFORE UPDATE ON public.crm_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Acknowledgement receipts
CREATE TABLE public.crm_update_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.crm_updates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

GRANT SELECT, INSERT ON public.crm_update_receipts TO authenticated;
GRANT ALL ON public.crm_update_receipts TO service_role;

ALTER TABLE public.crm_update_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own receipts"
  ON public.crm_update_receipts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users insert own receipts"
  ON public.crm_update_receipts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins delete receipts"
  ON public.crm_update_receipts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX crm_update_receipts_user_idx ON public.crm_update_receipts(user_id, notification_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_updates;