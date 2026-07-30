
-- 1. Storage: remove public lead-photos policies. Authenticated equivalents already exist.
DROP POLICY IF EXISTS "Anyone can read" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;

-- 2. activity_logs: SELECT should be admin-only (policy name already says "Admins and permitted", qual was 'true')
DROP POLICY IF EXISTS "Admins and permitted can read logs" ON public.activity_logs;
CREATE POLICY "Admins can read activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. lead_payments: restrict SELECT to admin, processor, or record creator
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='lead_payments' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.lead_payments', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins processors and creator can read lead payments"
  ON public.lead_payments
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'processor'::public.app_role)
    OR created_by = auth.uid()
  );

-- 4. lead_payment_requests: restrict SELECT to admin, processor, or requester
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='lead_payment_requests' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.lead_payment_requests', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins processors and requester can read payment requests"
  ON public.lead_payment_requests
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'processor'::public.app_role)
    OR requested_by = auth.uid()
  );

-- 5. notifications INSERT: only self, or admin (for creating notifications for others)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Self or admin can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'processor'::public.app_role)
    OR public.has_role(auth.uid(), 'customer_service'::public.app_role)
  );
