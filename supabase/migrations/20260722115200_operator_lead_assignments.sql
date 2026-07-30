-- =============================================================================
-- Operator Lead Assignments & OPR Notes Support
-- Lightweight migration — no heavy data operations, only DDL.
-- =============================================================================

-- 1. New table: lead_operator_assignments (junction table for lead ↔ operator)
CREATE TABLE IF NOT EXISTS lead_operator_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  operator_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, operator_user_id)
);

-- 2. Indexes for fast lookups (operator → their leads, lead → its operators)
CREATE INDEX IF NOT EXISTS idx_lead_opr_assignments_operator
  ON lead_operator_assignments (operator_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_opr_assignments_lead
  ON lead_operator_assignments (lead_id);

-- 3. RLS
ALTER TABLE lead_operator_assignments ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user can read (admin/processor need full view, opr needs own)
CREATE POLICY "Authenticated users can read lead_operator_assignments"
  ON lead_operator_assignments FOR SELECT TO authenticated USING (true);

-- Insert: admin or processor only
CREATE POLICY "Admin and processor can create lead_operator_assignments"
  ON lead_operator_assignments FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'processor'::app_role)
  );

-- Delete: admin or processor only (to un-assign)
CREATE POLICY "Admin and processor can delete lead_operator_assignments"
  ON lead_operator_assignments FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'processor'::app_role)
  );

-- 4. Enable Supabase Realtime so operators get instant assignment notifications
ALTER PUBLICATION supabase_realtime ADD TABLE lead_operator_assignments;
