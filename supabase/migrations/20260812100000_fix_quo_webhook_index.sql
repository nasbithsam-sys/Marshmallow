-- Drop the existing partial index
DROP INDEX IF EXISTS public.idx_quo_webhook_events_event_id;

-- Create a normal unique index (allows multiple NULLs in Postgres)
CREATE UNIQUE INDEX idx_quo_webhook_events_event_id 
  ON public.quo_webhook_events(quo_event_id);
