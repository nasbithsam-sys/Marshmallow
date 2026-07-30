-- =============================================================================
-- Update leads SELECT policy for Operator access
-- Replaces status-based access with assignment-based access
-- =============================================================================

DROP POLICY IF EXISTS "Users can view accessible leads" ON public.leads;

CREATE POLICY "Users can view accessible leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    (created_by = auth.uid())
    OR (assigned_cs = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'processor'::app_role)
    OR (
      has_role(auth.uid(), 'opr'::app_role) AND 
      EXISTS (
        SELECT 1 FROM public.lead_operator_assignments loa
        WHERE loa.lead_id = leads.id AND loa.operator_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_shares
      WHERE lead_shares.lead_id = leads.id
        AND lead_shares.shared_with_user_id = auth.uid()
    )
  );
