-- Enable pgcrypto if not already enabled (usually is, but good practice)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: quo_phone_numbers
CREATE TABLE IF NOT EXISTS public.quo_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quo_phone_number_id TEXT UNIQUE NOT NULL,
    number TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: quo_conversations
CREATE TABLE IF NOT EXISTS public.quo_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quo_conversation_id TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_number TEXT,
    number_id UUID REFERENCES public.quo_phone_numbers(id) ON DELETE SET NULL,
    last_message_preview TEXT,
    last_message_time TIMESTAMPTZ,
    direction TEXT,
    status TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: quo_messages
CREATE TABLE IF NOT EXISTS public.quo_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quo_message_id TEXT UNIQUE NOT NULL,
    conversation_id UUID REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'customer' or 'agent'
    text TEXT,
    message_time TIMESTAMPTZ,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: quo_conversation_flags
CREATE TABLE IF NOT EXISTS public.quo_conversation_flags (
    conversation_id UUID PRIMARY KEY REFERENCES public.quo_conversations(id) ON DELETE CASCADE,
    is_important BOOLEAN NOT NULL DEFAULT FALSE,
    needs_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
    is_delayed BOOLEAN NOT NULL DEFAULT FALSE,
    is_dead BOOLEAN NOT NULL DEFAULT FALSE,
    rule_result TEXT,
    reason TEXT,
    suggested_action TEXT,
    response_delay TEXT,
    last_customer_reply_time TIMESTAMPTZ,
    last_agent_reply_time TIMESTAMPTZ,
    followed_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: quo_sync_logs
CREATE TABLE IF NOT EXISTS public.quo_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quo_conversations_last_msg_time ON public.quo_conversations(last_message_time DESC);
CREATE INDEX IF NOT EXISTS idx_quo_messages_conversation_time ON public.quo_messages(conversation_id, message_time ASC);
CREATE INDEX IF NOT EXISTS idx_quo_conversations_number_id ON public.quo_conversations(number_id);
CREATE INDEX IF NOT EXISTS idx_quo_conversation_flags_important ON public.quo_conversation_flags(is_important);
CREATE INDEX IF NOT EXISTS idx_quo_conversation_flags_follow_up ON public.quo_conversation_flags(needs_follow_up);

-- Enable Row Level Security
ALTER TABLE public.quo_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_conversation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_sync_logs ENABLE ROW LEVEL SECURITY;

-- SELECT Policies (Allow all authenticated users)
CREATE POLICY "Allow authenticated read on quo_phone_numbers" ON public.quo_phone_numbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on quo_conversations" ON public.quo_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on quo_messages" ON public.quo_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on quo_conversation_flags" ON public.quo_conversation_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on quo_sync_logs" ON public.quo_sync_logs FOR SELECT TO authenticated USING (true);

-- UPDATE Policies (Allow admin, processor, customer_service)
CREATE POLICY "Allow authorized update on quo_conversations" ON public.quo_conversations FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'processor') OR public.has_role(auth.uid(), 'customer_service'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'processor') OR public.has_role(auth.uid(), 'customer_service'));

CREATE POLICY "Allow authorized update on quo_conversation_flags" ON public.quo_conversation_flags FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'processor') OR public.has_role(auth.uid(), 'customer_service'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'processor') OR public.has_role(auth.uid(), 'customer_service'));

-- We do not typically need direct frontend inserts into these tables (Edge Functions do it via service role)
-- But just in case flags need to be created if missing on update, allow insert for same roles
CREATE POLICY "Allow authorized insert on quo_conversation_flags" ON public.quo_conversation_flags FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'processor') OR public.has_role(auth.uid(), 'customer_service'));

-- Functions to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quo_phone_numbers_modtime
BEFORE UPDATE ON public.quo_phone_numbers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quo_conversations_modtime
BEFORE UPDATE ON public.quo_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quo_conversation_flags_modtime
BEFORE UPDATE ON public.quo_conversation_flags
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
