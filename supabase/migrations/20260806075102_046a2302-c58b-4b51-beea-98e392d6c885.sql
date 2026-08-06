CREATE TABLE public.quo_outbound_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  phone_number_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  quo_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.quo_outbound_messages TO authenticated;
GRANT ALL ON public.quo_outbound_messages TO service_role;

ALTER TABLE public.quo_outbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view outbound messages"
ON public.quo_outbound_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can queue outbound messages"
ON public.quo_outbound_messages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND created_by = auth.uid());

CREATE POLICY "Admins can update outbound messages"
ON public.quo_outbound_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX quo_outbound_messages_status_idx ON public.quo_outbound_messages (status, created_at);
CREATE INDEX quo_outbound_messages_to_number_idx ON public.quo_outbound_messages (to_number, created_at DESC);

CREATE TRIGGER update_quo_outbound_messages_updated_at
BEFORE UPDATE ON public.quo_outbound_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.quo_outbound_messages;