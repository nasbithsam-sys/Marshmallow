DO $$
DECLARE
  realtime_tables TEXT[] := ARRAY[
    'quo_conversations',
    'quo_messages',
    'ai_conversation_states',
    'ai_lead_links',
    'quo_pinned_conversations',
    'quo_number_preferences'
  ];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY realtime_tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = table_name
      )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
