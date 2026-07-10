REVOKE ALL ON FUNCTION public.enforce_quo_pinned_conversation_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_quo_pinned_conversation_limit() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_quo_pinned_conversation_limit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_quo_pinned_conversation_limit() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_quo_ai_job(uuid, uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_quo_ai_job(uuid, uuid, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_quo_ai_job(uuid, uuid, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_quo_ai_job(uuid, uuid, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.cron_ai_process_quo_jobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_ai_process_quo_jobs() FROM anon;
REVOKE ALL ON FUNCTION public.cron_ai_process_quo_jobs() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_ai_process_quo_jobs() TO service_role;

REVOKE ALL ON FUNCTION public.cron_quo_sync_contacts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_quo_sync_contacts() FROM anon;
REVOKE ALL ON FUNCTION public.cron_quo_sync_contacts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_quo_sync_contacts() TO service_role;

REVOKE ALL ON FUNCTION public.cron_quo_reconcile_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_quo_reconcile_sync() FROM anon;
REVOKE ALL ON FUNCTION public.cron_quo_reconcile_sync() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_quo_reconcile_sync() TO service_role;

REVOKE ALL ON FUNCTION public.cron_ai_reminder_checker() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_ai_reminder_checker() FROM anon;
REVOKE ALL ON FUNCTION public.cron_ai_reminder_checker() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_ai_reminder_checker() TO service_role;

REVOKE ALL ON FUNCTION public.cron_ai_sweep_conversations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_ai_sweep_conversations() FROM anon;
REVOKE ALL ON FUNCTION public.cron_ai_sweep_conversations() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_ai_sweep_conversations() TO service_role;

REVOKE ALL ON FUNCTION public.cron_ai_daily_brief() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_ai_daily_brief() FROM anon;
REVOKE ALL ON FUNCTION public.cron_ai_daily_brief() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_ai_daily_brief() TO service_role;