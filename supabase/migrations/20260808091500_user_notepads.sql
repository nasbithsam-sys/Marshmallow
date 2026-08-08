-- Migration: Create user_notepads table for per-user/per-role floating notepad

CREATE TABLE IF NOT EXISTS public.user_notepads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_notepads_user_id_key UNIQUE (user_id)
);

-- B-tree index on user_id for lightweight, sub-millisecond queries
CREATE INDEX IF NOT EXISTS idx_user_notepads_user_id ON public.user_notepads(user_id);

-- Enable RLS
ALTER TABLE public.user_notepads ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- SELECT policy: Users can view their own notepad; Admins can view all user notepads
CREATE POLICY "Users can view own notepad or admin views all"
  ON public.user_notepads
  FOR SELECT
  USING (
    auth.uid() = user_id OR public.is_admin_user(auth.uid())
  );

-- INSERT policy: Users can insert their own notepad; Admins can insert for any user
CREATE POLICY "Users can insert own notepad or admin inserts all"
  ON public.user_notepads
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR public.is_admin_user(auth.uid())
  );

-- UPDATE policy: Users can update their own notepad; Admins can update any notepad
CREATE POLICY "Users can update own notepad or admin updates all"
  ON public.user_notepads
  FOR UPDATE
  USING (
    auth.uid() = user_id OR public.is_admin_user(auth.uid())
  );

-- DELETE policy: Users can delete their own notepad; Admins can delete any notepad
CREATE POLICY "Users can delete own notepad or admin deletes all"
  ON public.user_notepads
  FOR DELETE
  USING (
    auth.uid() = user_id OR public.is_admin_user(auth.uid())
  );

-- Enable Realtime for live updates if multiple sessions are active
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notepads;
