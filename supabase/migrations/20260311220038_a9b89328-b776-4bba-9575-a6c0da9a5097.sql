
-- Make lead-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'lead-photos';

-- Add RLS policies for storage to allow authenticated access
CREATE POLICY "Authenticated users can upload to lead-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-photos');

CREATE POLICY "Authenticated users can read lead-photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-photos');

CREATE POLICY "Authenticated users can delete lead-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-photos');
