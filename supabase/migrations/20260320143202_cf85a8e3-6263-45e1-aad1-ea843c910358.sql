-- Fix: Allow any authenticated user to insert notifications (for cross-user notifications)
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);