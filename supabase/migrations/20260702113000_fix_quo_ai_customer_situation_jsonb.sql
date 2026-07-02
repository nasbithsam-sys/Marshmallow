ALTER TABLE public.quo_ai_conversation_state
  ALTER COLUMN customer_situation DROP DEFAULT;

ALTER TABLE public.quo_ai_conversation_state
  ALTER COLUMN customer_situation TYPE JSONB
  USING CASE
    WHEN customer_situation IS NULL THEN '{}'::jsonb
    ELSE jsonb_build_object('legacy_tags', to_jsonb(customer_situation))
  END;

ALTER TABLE public.quo_ai_conversation_state
  ALTER COLUMN customer_situation SET DEFAULT '{}'::jsonb;
