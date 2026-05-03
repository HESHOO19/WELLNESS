CREATE OR REPLACE FUNCTION public.get_account_type(_user_id uuid)
 RETURNS account_type
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.account_type
  FROM public.profiles p
  WHERE p.id = _user_id
$function$;
