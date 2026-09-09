-- LeadCancellationRequests and AppSidebar both subscribe to lead_cancellation_requests, but the
-- table was never added to the supabase_realtime publication (lead_payment_requests, added
-- alongside it, was). Those two subscriptions therefore receive nothing and the pages have been
-- relying on their 15s fallback polls. This publishes the table so the existing code works.
DO $$
BEGIN
  IF to_regclass('public.lead_cancellation_requests') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'lead_cancellation_requests'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_cancellation_requests;
  END IF;
END $$;

-- DELETE payloads carry only the primary key unless the row is replicated in full.
ALTER TABLE public.lead_cancellation_requests REPLICA IDENTITY FULL;
