-- 1. Pause webhook ingestion
INSERT INTO public.quo_ai_settings (key, value, description, updated_at)
VALUES ('quo_webhook_ingestion_paused', 'true'::jsonb, 'Quo Monitor ingestion paused: webhooks are acknowledged but nothing is stored.', now())
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();

-- 2. Stop all Quo/AI cron jobs
SELECT cron.unschedule(jobname) FROM cron.job
WHERE jobname IN ('quo-sync-contacts-every-30min','quo-reconcile-sync-cron','ai-process-quo-jobs-cron','ai-reminder-checker-cron');

-- 3. Purge Quo/AI data (children first)
DELETE FROM public.quo_ai_feedback;
DELETE FROM public.quo_ai_cost_logs;
DELETE FROM public.ai_usage_logs;
DELETE FROM public.ai_audit_logs;
DELETE FROM public.ai_review_queue;
DELETE FROM public.ai_reminders;
DELETE FROM public.ai_lead_links;
DELETE FROM public.quo_ai_tasks;
DELETE FROM public.quo_ai_tags;
DELETE FROM public.quo_ai_events;
DELETE FROM public.quo_ai_jobs;
DELETE FROM public.quo_pinned_conversations;
DELETE FROM public.quo_conversation_flags;
UPDATE public.ai_conversation_states SET latest_decision_id = NULL;
DELETE FROM public.ai_conversation_states;
DELETE FROM public.ai_decisions;
DELETE FROM public.quo_ai_conversation_state;
DELETE FROM public.quo_ai_daily_briefs;
DELETE FROM public.quo_messages;
DELETE FROM public.quo_conversations;
DELETE FROM public.quo_webhook_events;
DELETE FROM public.quo_sync_logs;