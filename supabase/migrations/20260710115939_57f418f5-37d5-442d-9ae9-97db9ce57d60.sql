-- Preserve names directly on historical CRM rows so the profile can be removed.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS last_edited_by_name text;

ALTER TABLE public.lead_notes
  ADD COLUMN IF NOT EXISTS user_name text;

ALTER TABLE public.lead_photos
  ADD COLUMN IF NOT EXISTS uploaded_by_name text;

ALTER TABLE public.lead_payments
  ADD COLUMN IF NOT EXISTS created_by_name text;

ALTER TABLE public.lead_payment_requests
  ADD COLUMN IF NOT EXISTS requested_by_name text,
  ADD COLUMN IF NOT EXISTS reviewed_by_name text;

ALTER TABLE public.lead_cancellation_requests
  ADD COLUMN IF NOT EXISTS requested_by_name text,
  ADD COLUMN IF NOT EXISTS reviewed_by_name text;

-- Backfill snapshot names from profiles for existing rows.
UPDATE public.leads l
SET created_by_name = COALESCE(l.created_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE l.created_by = p.id;

UPDATE public.leads l
SET last_edited_by_name = COALESCE(l.last_edited_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE l.last_edited_by = p.id;

UPDATE public.lead_notes n
SET user_name = COALESCE(n.user_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE n.user_id = p.id;

UPDATE public.lead_photos ph
SET uploaded_by_name = COALESCE(ph.uploaded_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE ph.uploaded_by = p.id;

UPDATE public.lead_payments lp
SET created_by_name = COALESCE(lp.created_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE lp.created_by = p.id;

UPDATE public.lead_payment_requests r
SET requested_by_name = COALESCE(r.requested_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE r.requested_by = p.id;

UPDATE public.lead_payment_requests r
SET reviewed_by_name = COALESCE(r.reviewed_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE r.reviewed_by = p.id;

UPDATE public.lead_cancellation_requests r
SET requested_by_name = COALESCE(r.requested_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE r.requested_by = p.id;

UPDATE public.lead_cancellation_requests r
SET reviewed_by_name = COALESCE(r.reviewed_by_name, p.full_name, p.email, 'Deleted user')
FROM public.profiles p
WHERE r.reviewed_by = p.id;

-- Preserve names for rows whose profile is already missing.
UPDATE public.leads
SET created_by_name = COALESCE(created_by_name, 'Deleted user')
WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leads.created_by);

UPDATE public.leads
SET last_edited_by_name = COALESCE(last_edited_by_name, 'Deleted user')
WHERE last_edited_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leads.last_edited_by);

UPDATE public.lead_notes
SET user_name = COALESCE(user_name, 'Deleted user')
WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_notes.user_id);

UPDATE public.lead_photos
SET uploaded_by_name = COALESCE(uploaded_by_name, 'Deleted user')
WHERE uploaded_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_photos.uploaded_by);

UPDATE public.lead_payments
SET created_by_name = COALESCE(created_by_name, 'Deleted user')
WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_payments.created_by);

UPDATE public.lead_payment_requests
SET requested_by_name = COALESCE(requested_by_name, 'Deleted user')
WHERE requested_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_payment_requests.requested_by);

UPDATE public.lead_payment_requests
SET reviewed_by_name = COALESCE(reviewed_by_name, 'Deleted user')
WHERE reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_payment_requests.reviewed_by);

UPDATE public.lead_cancellation_requests
SET requested_by_name = COALESCE(requested_by_name, 'Deleted user')
WHERE requested_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_cancellation_requests.requested_by);

UPDATE public.lead_cancellation_requests
SET reviewed_by_name = COALESCE(reviewed_by_name, 'Deleted user')
WHERE reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_cancellation_requests.reviewed_by);

-- Make historical user reference columns nullable where needed.
ALTER TABLE public.lead_notes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.lead_updates ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.lead_payment_requests ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE public.lead_cancellation_requests ALTER COLUMN requested_by DROP NOT NULL;

-- Clear orphan user links before moving CRM history FKs from auth.users to profiles.
UPDATE public.leads SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leads.created_by);
UPDATE public.leads SET assigned_cs = NULL WHERE assigned_cs IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leads.assigned_cs);
UPDATE public.leads SET last_edited_by = NULL WHERE last_edited_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = leads.last_edited_by);
UPDATE public.activity_logs SET user_id = NULL WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = activity_logs.user_id);
UPDATE public.lead_notes SET user_id = NULL WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_notes.user_id);
UPDATE public.lead_updates SET author_id = NULL WHERE author_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_updates.author_id);
UPDATE public.lead_photos SET uploaded_by = NULL WHERE uploaded_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_photos.uploaded_by);
UPDATE public.lead_payments SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_payments.created_by);
UPDATE public.lead_payment_requests SET requested_by = NULL WHERE requested_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_payment_requests.requested_by);
UPDATE public.lead_payment_requests SET reviewed_by = NULL WHERE reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_payment_requests.reviewed_by);
UPDATE public.lead_cancellation_requests SET requested_by = NULL WHERE requested_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_cancellation_requests.requested_by);
UPDATE public.lead_cancellation_requests SET reviewed_by = NULL WHERE reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = lead_cancellation_requests.reviewed_by);

-- Remove old auth-user foreign keys on CRM history, then link to profiles with SET NULL.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_created_by_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_cs_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_assigned_cs_fkey FOREIGN KEY (assigned_cs) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_last_edited_by_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_notes DROP CONSTRAINT IF EXISTS lead_notes_user_id_fkey;
ALTER TABLE public.lead_notes
  ADD CONSTRAINT lead_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_updates DROP CONSTRAINT IF EXISTS lead_updates_author_id_fkey;
ALTER TABLE public.lead_updates
  ADD CONSTRAINT lead_updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_photos DROP CONSTRAINT IF EXISTS lead_photos_uploaded_by_fkey;
ALTER TABLE public.lead_photos
  ADD CONSTRAINT lead_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_payments DROP CONSTRAINT IF EXISTS lead_payments_created_by_fkey;
ALTER TABLE public.lead_payments
  ADD CONSTRAINT lead_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_payment_requests DROP CONSTRAINT IF EXISTS lead_payment_requests_requested_by_fkey;
ALTER TABLE public.lead_payment_requests
  ADD CONSTRAINT lead_payment_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_payment_requests DROP CONSTRAINT IF EXISTS lead_payment_requests_reviewed_by_fkey;
ALTER TABLE public.lead_payment_requests
  ADD CONSTRAINT lead_payment_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_cancellation_requests DROP CONSTRAINT IF EXISTS lead_cancellation_requests_requested_by_fkey;
ALTER TABLE public.lead_cancellation_requests
  ADD CONSTRAINT lead_cancellation_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_cancellation_requests DROP CONSTRAINT IF EXISTS lead_cancellation_requests_reviewed_by_fkey;
ALTER TABLE public.lead_cancellation_requests
  ADD CONSTRAINT lead_cancellation_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Profiles should be removed from CRM when auth user is hard deleted.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Auth-delete trigger now stamps historical names and removes access-only rows, without preserving profile.
CREATE OR REPLACE FUNCTION public.handle_user_delete_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  preserved_name text;
BEGIN
  SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Deleted user')
  INTO preserved_name
  FROM public.profiles
  WHERE id = OLD.id;

  preserved_name := regexp_replace(COALESCE(preserved_name, 'Deleted user'), '\s*\(deleted\)$', '', 'i') || ' (deleted)';

  UPDATE public.leads SET created_by_name = preserved_name WHERE created_by = OLD.id AND created_by_name IS NULL;
  UPDATE public.leads SET last_edited_by_name = preserved_name WHERE last_edited_by = OLD.id AND last_edited_by_name IS NULL;
  UPDATE public.lead_notes SET user_name = preserved_name WHERE user_id = OLD.id AND user_name IS NULL;
  UPDATE public.lead_updates SET author_name = preserved_name WHERE author_id = OLD.id AND (author_name IS NULL OR trim(author_name) = '' OR lower(author_name) = 'unknown');
  UPDATE public.activity_logs SET user_name = preserved_name WHERE user_id = OLD.id AND (user_name IS NULL OR trim(user_name) = '' OR lower(user_name) = 'unknown user');
  UPDATE public.lead_photos SET uploaded_by_name = preserved_name WHERE uploaded_by = OLD.id AND uploaded_by_name IS NULL;
  UPDATE public.lead_payments SET created_by_name = preserved_name WHERE created_by = OLD.id AND created_by_name IS NULL;
  UPDATE public.lead_payment_requests SET requested_by_name = preserved_name WHERE requested_by = OLD.id AND requested_by_name IS NULL;
  UPDATE public.lead_payment_requests SET reviewed_by_name = preserved_name WHERE reviewed_by = OLD.id AND reviewed_by_name IS NULL;
  UPDATE public.lead_cancellation_requests SET requested_by_name = preserved_name WHERE requested_by = OLD.id AND requested_by_name IS NULL;
  UPDATE public.lead_cancellation_requests SET reviewed_by_name = preserved_name WHERE reviewed_by = OLD.id AND reviewed_by_name IS NULL;

  DELETE FROM public.user_roles WHERE user_id = OLD.id;
  DELETE FROM public.navigation_permissions WHERE user_id = OLD.id;
  DELETE FROM public.status_permissions WHERE user_id = OLD.id;
  DELETE FROM public.notifications WHERE user_id = OLD.id;
  DELETE FROM public.user_access_codes WHERE user_id = OLD.id;
  DELETE FROM public.lead_shares WHERE shared_with_user_id = OLD.id OR shared_by = OLD.id;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete_cleanup();