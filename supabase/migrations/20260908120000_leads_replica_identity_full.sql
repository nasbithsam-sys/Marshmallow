-- Enable REPLICA IDENTITY FULL on public.leads so that Postgres Realtime DELETE events broadcast all column values (including job_id)
ALTER TABLE public.leads REPLICA IDENTITY FULL;
