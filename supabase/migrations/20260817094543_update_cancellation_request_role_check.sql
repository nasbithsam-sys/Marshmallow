ALTER TABLE public.lead_cancellation_requests DROP CONSTRAINT IF EXISTS lead_cancellation_requests_requested_by_role_check;

ALTER TABLE public.lead_cancellation_requests
ADD CONSTRAINT lead_cancellation_requests_requested_by_role_check
CHECK (requested_by_role IN ('customer_service', 'processor', 'admin', 'cs_admin'));

