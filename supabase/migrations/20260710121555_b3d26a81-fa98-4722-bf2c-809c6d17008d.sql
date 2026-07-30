DROP POLICY IF EXISTS "Author can insert notes for accessible leads" ON public.lead_notes;
CREATE POLICY "Author can insert notes for accessible leads"
ON public.lead_notes
FOR INSERT
TO authenticated
WITH CHECK ((user_id = auth.uid()) AND (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_notes.lead_id)));

DROP POLICY IF EXISTS "Author or admin can delete notes" ON public.lead_notes;
CREATE POLICY "Author or admin can delete notes"
ON public.lead_notes
FOR DELETE
TO authenticated
USING ((user_id IS NOT NULL AND user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Author or admin can update notes" ON public.lead_notes;
CREATE POLICY "Author or admin can update notes"
ON public.lead_notes
FOR UPDATE
TO authenticated
USING ((user_id IS NOT NULL AND user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((user_id IS NOT NULL AND user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete lead photos" ON public.lead_photos;
CREATE POLICY "Admins can delete lead photos"
ON public.lead_photos
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR (uploaded_by IS NOT NULL AND uploaded_by = auth.uid()));