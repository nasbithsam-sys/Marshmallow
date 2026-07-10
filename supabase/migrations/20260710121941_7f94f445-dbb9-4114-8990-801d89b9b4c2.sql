ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_created_by_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_last_edited_by_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_notes DROP CONSTRAINT IF EXISTS lead_notes_user_id_fkey;
ALTER TABLE public.lead_notes
  ADD CONSTRAINT lead_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_updates DROP CONSTRAINT IF EXISTS lead_updates_author_id_fkey;
ALTER TABLE public.lead_updates
  ADD CONSTRAINT lead_updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lead_photos DROP CONSTRAINT IF EXISTS lead_photos_uploaded_by_fkey;
ALTER TABLE public.lead_photos
  ADD CONSTRAINT lead_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;