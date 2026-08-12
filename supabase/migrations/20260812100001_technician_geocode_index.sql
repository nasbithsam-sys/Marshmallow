-- Create index to quickly find technicians needing geocoding backfill
CREATE INDEX IF NOT EXISTS idx_technicians_missing_coords 
  ON public.technicians(id) 
  WHERE latitude IS NULL AND area IS NOT NULL;
