CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.quo_phone_numbers
  ADD COLUMN IF NOT EXISTS display_number TEXT,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS team TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.quo_conversations
  ADD COLUMN IF NOT EXISTS linked_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_ai_section TEXT NOT NULL DEFAULT 'needs_human_review',
  ADD COLUMN IF NOT EXISTS current_priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS current_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_agent_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rolling_ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS last_ai_analyzed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.quo_messages
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS quo_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.quo_conversations
SET
  last_message_at = COALESCE(last_message_at, last_message_time),
  current_status = COALESCE(NULLIF(current_status, ''), COALESCE(NULLIF(status, ''), 'open'))
WHERE last_message_at IS NULL OR current_status IS NULL OR current_status = '';

UPDATE public.quo_messages
SET
  direction = COALESCE(direction, CASE WHEN sender = 'customer' THEN 'inbound' ELSE 'outbound' END),
  quo_created_at = COALESCE(quo_created_at, message_time)
WHERE direction IS NULL OR quo_created_at IS NULL;

CREATE TABLE IF NOT EXISTS public.quo_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quo_event_id TEXT,
  event_type TEXT,
  quo_message_id TEXT,
  quo_conversation_id TEXT,
  quo_phone_number_id TEXT,
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quo_webhook_events_status_check CHECK (processing_status IN ('received', 'processing', 'processed', 'ignored', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quo_webhook_events_event_id
  ON public.quo_webhook_events(quo_event_id)
  WHERE quo_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quo_webhook_events_message_event
  ON public.quo_webhook_events(quo_message_id, event_type);

CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  latest_message_id UUID REFERENCES public.quo_messages(id) ON DELETE SET NULL,
  input_snapshot JSONB NOT NULL,
  input_hash TEXT NOT NULL,
  output_json JSONB NOT NULL,
  model_used TEXT,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'risky',
  applied_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  skipped_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  needs_human_review BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  evidence_message_ids TEXT[] NOT NULL DEFAULT '{}',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  estimated_cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_decisions_risk_check CHECK (risk_level IN ('safe', 'moderate', 'risky'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_decisions_conversation_input_hash
  ON public.ai_decisions(conversation_id, input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_conversation_created
  ON public.ai_decisions(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_conversation_states (
  conversation_id UUID PRIMARY KEY REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'needs_human_review',
  priority TEXT NOT NULL DEFAULT 'medium',
  customer_state TEXT NOT NULL DEFAULT 'unclear',
  lead_state TEXT,
  needs_reply BOOLEAN NOT NULL DEFAULT FALSE,
  should_create_lead BOOLEAN NOT NULL DEFAULT FALSE,
  should_link_lead BOOLEAN NOT NULL DEFAULT FALSE,
  should_create_reminder BOOLEAN NOT NULL DEFAULT FALSE,
  is_possible_dead BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost BOOLEAN NOT NULL DEFAULT FALSE,
  lost_reason TEXT,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'risky',
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  latest_decision_id UUID REFERENCES public.ai_decisions(id) ON DELETE SET NULL,
  human_review_status TEXT NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_conversation_states_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT ai_conversation_states_risk_check CHECK (risk_level IN ('safe', 'moderate', 'risky')),
  CONSTRAINT ai_conversation_states_review_check CHECK (human_review_status IN ('pending', 'reviewed', 'not_needed'))
);

CREATE TABLE IF NOT EXISTS public.ai_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  reminder_type TEXT NOT NULL DEFAULT 'follow_up',
  due_at TIMESTAMPTZ NOT NULL,
  notify_one_day_before BOOLEAN NOT NULL DEFAULT TRUE,
  notify_same_day BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  source_message_id UUID REFERENCES public.quo_messages(id) ON DELETE SET NULL,
  created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT ai_reminders_type_check CHECK (reminder_type IN ('follow_up', 'call', 'appointment', 'quote', 'other')),
  CONSTRAINT ai_reminders_status_check CHECK (status IN ('pending', 'done', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_ai_reminders_due_status ON public.ai_reminders(status, due_at);
CREATE INDEX IF NOT EXISTS idx_ai_reminders_conversation ON public.ai_reminders(conversation_id);

CREATE TABLE IF NOT EXISTS public.ai_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES public.ai_decisions(id) ON DELETE SET NULL,
  review_type TEXT NOT NULL DEFAULT 'decision',
  reason TEXT NOT NULL,
  suggested_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_review_queue_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_ai_review_queue_status_created ON public.ai_review_queue(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_lead_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL DEFAULT 'ai_suggested',
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_lead_links_match_type_check CHECK (match_type IN ('exact_phone', 'manual', 'ai_suggested')),
  UNIQUE(conversation_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_lead_links_lead ON public.ai_lead_links(lead_id);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.quo_conversations(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES public.ai_decisions(id) ON DELETE SET NULL,
  model_used TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  call_type TEXT NOT NULL DEFAULT 'conversation_analysis',
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES public.ai_decisions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_conversation_created
  ON public.ai_audit_logs(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quo_conversations_ai_section ON public.quo_conversations(current_ai_section);
CREATE INDEX IF NOT EXISTS idx_quo_conversations_priority ON public.quo_conversations(current_priority);
CREATE INDEX IF NOT EXISTS idx_quo_conversations_linked_lead ON public.quo_conversations(linked_lead_id);
CREATE INDEX IF NOT EXISTS idx_quo_conversations_customer_number ON public.quo_conversations(customer_number);
CREATE INDEX IF NOT EXISTS idx_quo_conversations_last_message_at ON public.quo_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_quo_messages_quo_created_at ON public.quo_messages(quo_created_at DESC);

ALTER TABLE public.quo_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lead_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read quo webhook events"
  ON public.quo_webhook_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read ai decisions"
  ON public.ai_decisions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read ai conversation states"
  ON public.ai_conversation_states FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized update ai conversation states"
  ON public.ai_conversation_states FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
    OR public.has_role(auth.uid(), 'customer_service')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
    OR public.has_role(auth.uid(), 'customer_service')
  );

CREATE POLICY "Authenticated read ai reminders"
  ON public.ai_reminders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized manage ai reminders"
  ON public.ai_reminders FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
    OR public.has_role(auth.uid(), 'customer_service')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
    OR public.has_role(auth.uid(), 'customer_service')
  );

CREATE POLICY "Authenticated read ai review queue"
  ON public.ai_review_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized update ai review queue"
  ON public.ai_review_queue FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
    OR public.has_role(auth.uid(), 'customer_service')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
    OR public.has_role(auth.uid(), 'customer_service')
  );

CREATE POLICY "Authenticated read ai lead links"
  ON public.ai_lead_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized insert manual ai lead links"
  ON public.ai_lead_links FOR INSERT TO authenticated
  WITH CHECK (
    created_by_ai = FALSE
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'processor')
      OR public.has_role(auth.uid(), 'customer_service')
    )
  );

CREATE POLICY "Admins read ai usage logs"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read ai audit logs"
  ON public.ai_audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized insert ai audit logs"
  ON public.ai_audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'processor')
      OR public.has_role(auth.uid(), 'customer_service')
    )
  );

DROP TRIGGER IF EXISTS update_ai_conversation_states_modtime ON public.ai_conversation_states;
CREATE TRIGGER update_ai_conversation_states_modtime
BEFORE UPDATE ON public.ai_conversation_states
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
