DO $$
BEGIN
  IF to_regclass('public.quo_ai_conversation_state') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'quo_ai_conversation_state'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quo_ai_conversation_state;
  END IF;
END $$;