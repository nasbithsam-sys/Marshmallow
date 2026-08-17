DROP POLICY IF EXISTS "CS and processors can create cancellation requests" ON public.lead_cancellation_requests;

CREATE POLICY "CS and processors can create cancellation requests"
ON public.lead_cancellation_requests
FOR INSERT
TO authenticated
WITH CHECK ((requested_by = auth.uid()) AND (requested_by_role IN ('customer_service', 'processor', 'cs_admin')));

