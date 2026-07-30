select cron.unschedule('ai-daily-brief-cron');
select cron.unschedule('ai-sweep-conversations-cron');
delete from public.quo_ai_jobs where status in ('failed','pending') and (job_type <> 'message_analysis' or created_at < now() - interval '1 day');