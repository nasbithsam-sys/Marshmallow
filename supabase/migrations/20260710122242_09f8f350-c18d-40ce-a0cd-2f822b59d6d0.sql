DROP POLICY IF EXISTS "CS and processors can create cancellation requests" ON public.lead_cancellation_requests;
DROP POLICY IF EXISTS "Users can create cancellation requests" ON public.lead_cancellation_requests;
CREATE POLICY "CS and processors can create cancellation requests"
ON public.lead_cancellation_requests
FOR INSERT
TO authenticated
WITH CHECK ((requested_by = auth.uid()) AND (requested_by_role IN ('customer_service', 'processor')));

DROP POLICY IF EXISTS "Reviewers can update cancellation requests" ON public.lead_cancellation_requests;
CREATE POLICY "Reviewers can update cancellation requests"
ON public.lead_cancellation_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'processor'::public.app_role))
WITH CHECK (reviewed_by IS NULL OR reviewed_by = auth.uid());

DROP POLICY IF EXISTS "Processors can create payment requests" ON public.lead_payment_requests;
DROP POLICY IF EXISTS "Users can create payment requests" ON public.lead_payment_requests;
CREATE POLICY "Processors can create payment requests"
ON public.lead_payment_requests
FOR INSERT
TO authenticated
WITH CHECK ((requested_by = auth.uid()) AND public.has_role(auth.uid(), 'processor'::public.app_role));

DROP POLICY IF EXISTS "Admins can update payment requests" ON public.lead_payment_requests;
CREATE POLICY "Admins can update payment requests"
ON public.lead_payment_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (reviewed_by IS NULL OR reviewed_by = auth.uid());