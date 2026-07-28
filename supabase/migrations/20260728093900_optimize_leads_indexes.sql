-- Optimize leads table queries for high CPU performance
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_customer_phone ON public.leads(customer_phone);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads(city);

-- Optimize child tables foreign keys (crucial for RLS policies)
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_photos_lead_id ON public.lead_photos(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_shares_lead_id ON public.lead_shares(lead_id);

-- Optimize notifications queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
