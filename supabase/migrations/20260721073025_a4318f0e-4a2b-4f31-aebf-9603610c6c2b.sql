
CREATE TABLE IF NOT EXISTS public.us_places (
  geoid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  state_name TEXT,
  population INTEGER NOT NULL DEFAULT 0,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  population_vintage INTEGER,
  geography_vintage INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS us_places_lat_lng_idx ON public.us_places (latitude, longitude);
CREATE INDEX IF NOT EXISTS us_places_population_idx ON public.us_places (population DESC);

GRANT SELECT ON public.us_places TO authenticated;
GRANT ALL ON public.us_places TO service_role;

ALTER TABLE public.us_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read us_places" ON public.us_places;
CREATE POLICY "Authenticated can read us_places"
  ON public.us_places
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.get_top_nearby_populated_areas(
  _latitude double precision,
  _longitude double precision
)
RETURNS TABLE (
  geoid text,
  name text,
  state_code text,
  state_name text,
  population integer,
  latitude double precision,
  longitude double precision,
  distance_miles double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH input AS (
    SELECT
      _latitude AS lat,
      _longitude AS lng
    WHERE _latitude BETWEEN -90 AND 90
      AND _longitude BETWEEN -180 AND 180
  ),
  bounds AS (
    SELECT
      lat,
      lng,
      lat - (50.0 / 69.0) AS lat_min,
      lat + (50.0 / 69.0) AS lat_max,
      lng - (50.0 / (69.0 * GREATEST(cos(radians(lat)), 0.05))) AS lng_min,
      lng + (50.0 / (69.0 * GREATEST(cos(radians(lat)), 0.05))) AS lng_max
    FROM input
  ),
  candidates AS (
    SELECT
      p.geoid,
      p.name,
      p.state_code,
      p.state_name,
      p.population,
      p.latitude,
      p.longitude,
      3958.7613 * 2 * asin(LEAST(1.0, sqrt(
        power(sin(radians((p.latitude - b.lat) / 2)), 2)
        + cos(radians(b.lat)) * cos(radians(p.latitude))
          * power(sin(radians((p.longitude - b.lng) / 2)), 2)
      ))) AS distance_miles
    FROM public.us_places p
    JOIN bounds b
      ON p.latitude BETWEEN b.lat_min AND b.lat_max
     AND p.longitude BETWEEN b.lng_min AND b.lng_max
    WHERE p.population > 0
  )
  SELECT geoid, name, state_code, state_name, population, latitude, longitude, distance_miles
  FROM candidates
  WHERE distance_miles <= 50
  ORDER BY population DESC, distance_miles ASC, name ASC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_nearby_populated_areas(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_nearby_populated_areas(double precision, double precision) TO service_role;
