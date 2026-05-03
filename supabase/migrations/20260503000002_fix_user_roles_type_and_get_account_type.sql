-- Fix user_roles.role column: ensure it uses account_type (not app_role)
-- Fix get_account_type to never reference app_role enum

-- 1. Ensure user_roles.role is account_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'role'
    AND udt_name = 'app_role'
  ) THEN
    ALTER TABLE public.user_roles
      ALTER COLUMN role TYPE public.account_type
      USING role::text::public.account_type;
  END IF;
END $$;

-- 2. Final authoritative version of get_account_type
CREATE OR REPLACE FUNCTION public.get_account_type(_user_id uuid)
RETURNS public.account_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_type FROM public.profiles WHERE id = _user_id
$$;
