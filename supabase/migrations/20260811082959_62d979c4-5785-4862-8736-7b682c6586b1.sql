-- Drop AI-only helper functions
DROP FUNCTION IF EXISTS public.cron_ai_daily_brief();
DROP FUNCTION IF EXISTS public.cron_ai_process_quo_jobs();
DROP FUNCTION IF EXISTS public.cron_ai_reminder_checker();
DROP FUNCTION IF EXISTS public.cron_ai_sweep_conversations();
DROP FUNCTION IF EXISTS public.enqueue_quo_ai_job(uuid, uuid, text, text, integer);

-- Drop AI-only tables (order irrelevant with CASCADE)
DROP TABLE IF EXISTS public.ai_audit_logs CASCADE;
DROP TABLE IF EXISTS public.ai_usage_logs CASCADE;
DROP TABLE IF EXISTS public.ai_review_queue CASCADE;
DROP TABLE IF EXISTS public.ai_reminders CASCADE;
DROP TABLE IF EXISTS public.ai_lead_links CASCADE;
DROP TABLE IF EXISTS public.ai_conversation_states CASCADE;
DROP TABLE IF EXISTS public.ai_decisions CASCADE;
DROP TABLE IF EXISTS public.quo_ai_feedback CASCADE;
DROP TABLE IF EXISTS public.quo_ai_cost_logs CASCADE;
DROP TABLE IF EXISTS public.quo_ai_daily_briefs CASCADE;
DROP TABLE IF EXISTS public.quo_ai_events CASCADE;
DROP TABLE IF EXISTS public.quo_ai_tasks CASCADE;
DROP TABLE IF EXISTS public.quo_ai_tags CASCADE;
DROP TABLE IF EXISTS public.quo_ai_jobs CASCADE;
DROP TABLE IF EXISTS public.quo_ai_conversation_state CASCADE;