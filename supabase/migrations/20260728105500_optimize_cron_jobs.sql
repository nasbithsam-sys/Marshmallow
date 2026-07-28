-- Reduce frequency of heavy AI background tasks to preserve CPU credits on Nano/Micro tiers

SELECT cron.unschedule('ai-process-quo-jobs-cron');
SELECT cron.unschedule('ai-reminder-checker-cron');
SELECT cron.unschedule('ai-sweep-conversations-cron');

-- Re-schedule process jobs to run every 5 minutes (was 1 min)
SELECT cron.schedule(
    'ai-process-quo-jobs-cron',
    '*/5 * * * *',
    'SELECT public.cron_ai_process_quo_jobs()'
);

-- Re-schedule reminder checker to run every 10 minutes (was 3 mins)
SELECT cron.schedule(
    'ai-reminder-checker-cron',
    '*/10 * * * *',
    'SELECT public.cron_ai_reminder_checker()'
);

-- Re-schedule conversation sweeper to run every 30 minutes (was 15 mins)
SELECT cron.schedule(
    'ai-sweep-conversations-cron',
    '*/30 * * * *',
    'SELECT public.cron_ai_sweep_conversations()'
);
