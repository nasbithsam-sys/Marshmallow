-- Keep only the newest failed/running job per (conversation_id, job_type); delete older duplicates.
DELETE FROM public.quo_ai_jobs a
USING public.quo_ai_jobs b
WHERE a.status IN ('failed','running')
  AND b.status IN ('failed','running')
  AND a.conversation_id = b.conversation_id
  AND a.job_type = b.job_type
  AND a.updated_at < b.updated_at;

-- Re-queue whatever remains.
UPDATE public.quo_ai_jobs
SET status = 'pending',
    attempts = 0,
    locked_at = NULL,
    locked_by = NULL,
    error_message = NULL,
    run_after = now()
WHERE status IN ('failed','running');