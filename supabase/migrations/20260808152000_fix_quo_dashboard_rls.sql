-- Fix RLS Policies for QUO Dashboard so all authenticated users can view & manage conversations

ALTER TABLE public.quo_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quo_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized read on quo_phone_numbers" ON public.quo_phone_numbers;
DROP POLICY IF EXISTS "Allow authenticated read on quo_phone_numbers" ON public.quo_phone_numbers;
DROP POLICY IF EXISTS "Allow all authenticated read on quo_phone_numbers" ON public.quo_phone_numbers;
CREATE POLICY "Allow all authenticated read on quo_phone_numbers"
  ON public.quo_phone_numbers FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authorized read on quo_conversations" ON public.quo_conversations;
DROP POLICY IF EXISTS "Allow authenticated read on quo_conversations" ON public.quo_conversations;
DROP POLICY IF EXISTS "Allow all authenticated read on quo_conversations" ON public.quo_conversations;
CREATE POLICY "Allow all authenticated read on quo_conversations"
  ON public.quo_conversations FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated update on quo_conversations" ON public.quo_conversations;
CREATE POLICY "Allow authenticated update on quo_conversations"
  ON public.quo_conversations FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert on quo_conversations" ON public.quo_conversations;
CREATE POLICY "Allow authenticated insert on quo_conversations"
  ON public.quo_conversations FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authorized read on quo_messages" ON public.quo_messages;
DROP POLICY IF EXISTS "Allow authenticated read on quo_messages" ON public.quo_messages;
DROP POLICY IF EXISTS "Allow all authenticated read on quo_messages" ON public.quo_messages;
CREATE POLICY "Allow all authenticated read on quo_messages"
  ON public.quo_messages FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert on quo_messages" ON public.quo_messages;
CREATE POLICY "Allow authenticated insert on quo_messages"
  ON public.quo_messages FOR INSERT TO authenticated
  WITH CHECK (true);
