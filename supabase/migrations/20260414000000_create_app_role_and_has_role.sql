-- Create app_role enum (used by admin policies and has_role function)
-- Must exist before any migration that references has_role or app_role policies
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'user', 'super_admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- has_role bridges app_role checks against user_roles (which uses account_type)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  );
$function$;
