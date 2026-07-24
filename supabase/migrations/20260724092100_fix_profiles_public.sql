-- =============================================================================
-- Fix profiles_public view so it correctly bypasses RLS for limited columns
-- =============================================================================

-- Remove security_invoker so the view runs as the owner (bypassing RLS on profiles)
-- This allows all users to read the full_name of any other user for UI display (like operators in Assign Dialog)
ALTER VIEW public.profiles_public SET (security_invoker = off);
