-- Fix multiple permissive policies by dropping redundant rules

-- 1. ai_reminders
DROP POLICY IF EXISTS "Authorized read ai reminders" ON public.ai_reminders;

-- 2. crm_updates
DROP POLICY IF EXISTS "Users read active updates for their role" ON public.crm_updates;

-- 3. lead_cancellation_requests
DROP POLICY IF EXISTS "CS and processors can create cancellation requests" ON public.lead_cancellation_requests;

-- 4. lead_payment_requests
DROP POLICY IF EXISTS "Processors can create payment requests" ON public.lead_payment_requests;

-- 5. leads
DROP POLICY IF EXISTS "Users can view accessible leads" ON public.leads;

-- 6. quo_ai_tags
DROP POLICY IF EXISTS "Authorized read quo ai tags" ON public.quo_ai_tags;

-- 7. quo_ai_tasks
DROP POLICY IF EXISTS "Authorized read quo ai tasks" ON public.quo_ai_tasks;

-- 8. quo_number_preferences
DROP POLICY IF EXISTS "Admins read quo number preferences" ON public.quo_number_preferences;

-- 9. quo_pinned_conversations
DROP POLICY IF EXISTS "Admins read quo pinned conversations" ON public.quo_pinned_conversations;

-- 10. user_roles
DROP POLICY IF EXISTS "Authenticated can read roles" ON public.user_roles;
