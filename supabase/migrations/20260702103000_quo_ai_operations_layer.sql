CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.quo_ai_conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  quo_phone_number_id UUID REFERENCES public.quo_phone_numbers(id) ON DELETE SET NULL,
  linked_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ai_summary TEXT,
  service_needed TEXT,
  customer_issue TEXT,
  lead_stage TEXT NOT NULL DEFAULT 'needs_human_review',
  customer_situation TEXT[] NOT NULL DEFAULT '{}',
  waiting_on TEXT NOT NULL DEFAULT 'unknown',
  urgency_level TEXT NOT NULL DEFAULT 'medium',
  urgency_score INTEGER NOT NULL DEFAULT 50,
  sentiment TEXT NOT NULL DEFAULT 'unknown',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  current_status TEXT NOT NULL DEFAULT 'open',
  next_action TEXT,
  next_action_due_at TIMESTAMPTZ,
  assigned_role TEXT NOT NULL DEFAULT 'customer_service',
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  schedule_status TEXT NOT NULL DEFAULT 'unknown',
  quote_status TEXT NOT NULL DEFAULT 'unknown',
  payment_status TEXT NOT NULL DEFAULT 'unknown',
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  requires_human_review BOOLEAN NOT NULL DEFAULT TRUE,
  human_review_reason TEXT,
  last_ai_checked_at TIMESTAMPTZ,
  last_message_id UUID REFERENCES public.quo_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quo_ai_state_waiting_on_check CHECK (waiting_on IN ('staff', 'customer', 'technician', 'manager', 'no_one', 'unknown')),
  CONSTRAINT quo_ai_state_urgency_level_check CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT quo_ai_state_urgency_score_check CHECK (urgency_score BETWEEN 0 AND 100),
  CONSTRAINT quo_ai_state_sentiment_check CHECK (sentiment IN ('positive', 'neutral', 'confused', 'angry', 'frustrated', 'unknown')),
  CONSTRAINT quo_ai_state_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT quo_ai_state_schedule_status_check CHECK (schedule_status IN ('none', 'requested', 'tentative', 'unconfirmed', 'confirmed', 'reschedule_needed', 'unknown')),
  CONSTRAINT quo_ai_state_quote_status_check CHECK (quote_status IN ('none', 'needed', 'sent', 'accepted', 'rejected', 'follow_up_due', 'unknown')),
  CONSTRAINT quo_ai_state_payment_status_check CHECK (payment_status IN ('none', 'pending', 'paid', 'dispute', 'unknown'))
);

CREATE TABLE IF NOT EXISTS public.quo_ai_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  reason TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quo_ai_tags_status_check CHECK (status IN ('active', 'removed', 'rejected')),
  UNIQUE(conversation_id, tag)
);

CREATE TABLE IF NOT EXISTS public.quo_ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  linked_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  reason TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  due_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  assigned_role TEXT NOT NULL DEFAULT 'customer_service',
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quo_ai_tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT quo_ai_tasks_status_check CHECK (status IN ('open', 'done', 'snoozed', 'cancelled', 'needs_review'))
);

CREATE TABLE IF NOT EXISTS public.quo_ai_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quo_ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  latest_message_id UUID REFERENCES public.quo_messages(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL DEFAULT 'message_analysis',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  error_message TEXT,
  input_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quo_ai_jobs_type_check CHECK (job_type IN ('message_analysis', 'sweep_analysis', 'risk_verification', 'daily_brief', 'historical_backfill')),
  CONSTRAINT quo_ai_jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT quo_ai_jobs_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quo_ai_jobs_pending_dedupe
  ON public.quo_ai_jobs(conversation_id, job_type)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.quo_ai_cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.quo_conversations(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.quo_ai_jobs(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quo_ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.quo_ai_tasks(id) ON DELETE SET NULL,
  tag_id UUID REFERENCES public.quo_ai_tags(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,
  user_note TEXT,
  previous_ai_json JSONB,
  corrected_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quo_ai_feedback_type_check CHECK (
    feedback_type IN ('correct', 'incorrect', 'partially_correct', 'missed_issue', 'wrong_priority', 'wrong_next_action')
  )
);

CREATE TABLE IF NOT EXISTS public.quo_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quo_ai_daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  summary TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  urgent_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quo_ai_state_conversation ON public.quo_ai_conversation_state(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_state_review ON public.quo_ai_conversation_state(requires_human_review, urgency_level);
CREATE INDEX IF NOT EXISTS idx_quo_ai_state_last_checked ON public.quo_ai_conversation_state(last_ai_checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_quo_ai_state_due ON public.quo_ai_conversation_state(next_action_due_at);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tags_conversation ON public.quo_ai_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tags_tag_status ON public.quo_ai_tags(tag, status);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_conversation ON public.quo_ai_tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_due_status ON public.quo_ai_tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_priority ON public.quo_ai_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_assigned_role ON public.quo_ai_tasks(assigned_role);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_review ON public.quo_ai_tasks(requires_human_review);
CREATE INDEX IF NOT EXISTS idx_quo_ai_events_conversation ON public.quo_ai_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_events_type ON public.quo_ai_events(event_type);
CREATE INDEX IF NOT EXISTS idx_quo_ai_jobs_status_run_after ON public.quo_ai_jobs(status, run_after, priority);
CREATE INDEX IF NOT EXISTS idx_quo_ai_jobs_conversation ON public.quo_ai_jobs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_cost_logs_created ON public.quo_ai_cost_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quo_ai_cost_logs_feature ON public.quo_ai_cost_logs(feature);
CREATE INDEX IF NOT EXISTS idx_quo_ai_feedback_conversation ON public.quo_ai_feedback(conversation_id);

ALTER TABLE public.quo_ai_conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_cost_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_ai_daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized read quo ai conversation state"
  ON public.quo_ai_conversation_state FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized manage quo ai conversation state"
  ON public.quo_ai_conversation_state FOR UPDATE TO authenticated
  USING (public.can_access_quo_ai())
  WITH CHECK (public.can_access_quo_ai());

CREATE POLICY "Authorized read quo ai tags"
  ON public.quo_ai_tags FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized manage quo ai tags"
  ON public.quo_ai_tags FOR ALL TO authenticated
  USING (public.can_access_quo_ai())
  WITH CHECK (public.can_access_quo_ai());

CREATE POLICY "Authorized read quo ai tasks"
  ON public.quo_ai_tasks FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized manage quo ai tasks"
  ON public.quo_ai_tasks FOR ALL TO authenticated
  USING (public.can_access_quo_ai())
  WITH CHECK (public.can_access_quo_ai());

CREATE POLICY "Authorized read quo ai events"
  ON public.quo_ai_events FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Admins read quo ai jobs"
  ON public.quo_ai_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins read quo ai cost logs"
  ON public.quo_ai_cost_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authorized read quo ai feedback"
  ON public.quo_ai_feedback FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized insert quo ai feedback"
  ON public.quo_ai_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_quo_ai());

CREATE POLICY "Admins manage quo ai settings"
  ON public.quo_ai_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authorized read quo ai daily briefs"
  ON public.quo_ai_daily_briefs FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

DROP TRIGGER IF EXISTS update_quo_ai_state_modtime ON public.quo_ai_conversation_state;
CREATE TRIGGER update_quo_ai_state_modtime
BEFORE UPDATE ON public.quo_ai_conversation_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quo_ai_tags_modtime ON public.quo_ai_tags;
CREATE TRIGGER update_quo_ai_tags_modtime
BEFORE UPDATE ON public.quo_ai_tags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quo_ai_tasks_modtime ON public.quo_ai_tasks;
CREATE TRIGGER update_quo_ai_tasks_modtime
BEFORE UPDATE ON public.quo_ai_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quo_ai_jobs_modtime ON public.quo_ai_jobs;
CREATE TRIGGER update_quo_ai_jobs_modtime
BEFORE UPDATE ON public.quo_ai_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enqueue_quo_ai_job(
  _conversation_id UUID,
  _latest_message_id UUID DEFAULT NULL,
  _job_type TEXT DEFAULT 'message_analysis',
  _priority TEXT DEFAULT 'medium',
  _debounce_seconds INTEGER DEFAULT 60
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_id UUID;
  target_run_after TIMESTAMPTZ := NOW() + make_interval(secs => GREATEST(_debounce_seconds, 0));
BEGIN
  INSERT INTO public.quo_ai_jobs (
    conversation_id,
    latest_message_id,
    job_type,
    status,
    priority,
    run_after
  )
  VALUES (
    _conversation_id,
    _latest_message_id,
    _job_type,
    'pending',
    _priority,
    target_run_after
  )
  ON CONFLICT (conversation_id, job_type)
  WHERE status = 'pending'
  DO UPDATE SET
    latest_message_id = COALESCE(EXCLUDED.latest_message_id, public.quo_ai_jobs.latest_message_id),
    priority = CASE
      WHEN public.quo_ai_jobs.priority = 'critical' OR EXCLUDED.priority = 'critical' THEN 'critical'
      WHEN public.quo_ai_jobs.priority = 'high' OR EXCLUDED.priority = 'high' THEN 'high'
      WHEN public.quo_ai_jobs.priority = 'medium' OR EXCLUDED.priority = 'medium' THEN 'medium'
      ELSE 'low'
    END,
    run_after = LEAST(public.quo_ai_jobs.run_after, target_run_after),
    updated_at = NOW()
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$;

INSERT INTO public.quo_ai_settings (key, value, description)
VALUES
  ('monthly_budget_soft_cap_usd', '180'::jsonb, 'Soft monthly AI budget cap.'),
  ('monthly_budget_hard_cap_usd', '200'::jsonb, 'Hard monthly AI budget cap.'),
  ('daily_call_limit', '500'::jsonb, 'Maximum AI calls per day.'),
  ('message_debounce_seconds', '60'::jsonb, 'Delay before analyzing rapid inbound messages.'),
  ('missed_reply_minutes', '30'::jsonb, 'Customer wait threshold before missed reply task.'),
  ('risk_verifier_enabled', 'true'::jsonb, 'Whether risky cases may use the verifier model.')
ON CONFLICT (key) DO NOTHING;
