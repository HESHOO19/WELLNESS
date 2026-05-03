-- Add fallback user_roles support for legacy role-based RLS checks

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.account_type NOT NULL DEFAULT 'buyer',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Backfill role mapping from existing profiles when possible.
INSERT INTO public.user_roles (user_id, role)
SELECT id, account_type
FROM public.profiles
WHERE account_type IN ('buyer', 'supplier')
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_account_type(_user_id uuid)
RETURNS public.account_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_type FROM public.profiles WHERE id = _user_id
$$;