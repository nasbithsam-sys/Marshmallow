

## Current State

The photo thumbnail feature on lead cards is **already implemented** in the codebase:

- `AddLeadDialog` uploads photos to `lead-photos` bucket and stores URLs in `lead_photos` table
- `LeadCard` fetches photos from `lead_photos`, combines them with payment screenshots, and renders a thumbnail gallery
- Clicking any thumbnail opens the `ImageLightbox` fullscreen viewer

No code changes are needed. The feature is complete.

### Possible issue: photos not appearing

If thumbnails aren't showing after adding a lead with photos, the most likely causes are:

1. **Storage bucket not public** — The `lead-photos` bucket may not be set to public, so `getPublicUrl()` returns a URL that 403s
2. **RLS on `lead_photos` table** — Read policies may be missing, preventing the SELECT query from returning results
3. **Upload failing silently** — The upload may fail but errors aren't surfaced prominently

### Recommended actions

1. **Verify the `lead-photos` bucket is public** — Run this SQL if needed:
   ```sql
   UPDATE storage.buckets SET public = true WHERE id = 'lead-photos';
   ```

2. **Verify `lead_photos` table has a SELECT RLS policy** — If missing, add:
   ```sql
   CREATE POLICY "Anyone can read lead photos"
   ON public.lead_photos FOR SELECT
   TO authenticated
   USING (true);
   ```

3. **Verify storage INSERT policy exists** for `lead-photos` bucket:
   ```sql
   CREATE POLICY "Authenticated users can upload lead photos"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'lead-photos');
   ```

If you want, I can run these SQL fixes to ensure the photo upload and display pipeline works end-to-end.

