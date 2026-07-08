WITH retryable AS (
  SELECT j.id,
         row_number() OVER (PARTITION BY j.conversation_id, j.job_type ORDER BY j.updated_at DESC, j.created_at DESC) AS rn
  FROM public.quo_ai_jobs j
  WHERE (
      (j.status = 'running' AND j.locked_at < now() - interval '10 minutes')
      OR (
        j.status = 'failed'
        AND (
          j.error_message ILIKE '%max_tokens%'
          OR j.error_message ILIKE '%customer_situation must be an object%'
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.quo_ai_jobs p
      WHERE p.conversation_id = j.conversation_id
        AND p.job_type = j.job_type
        AND p.status = 'pending'
    )
)
UPDATE public.quo_ai_jobs j
SET status = 'pending',
    attempts = 0,
    locked_at = NULL,
    locked_by = NULL,
    error_message = NULL,
    run_after = now(),
    updated_at = now()
FROM retryable r
WHERE j.id = r.id
  AND r.rn = 1;