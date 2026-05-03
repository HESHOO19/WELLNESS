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

DROP POLICY IF EXISTS "Suppliers can view own products" ON products;
CREATE POLICY "Suppliers can view own products"
  ON products FOR SELECT
  USING (
    (get_account_type(auth.uid()) = 'supplier'::account_type)
    AND (supplier_id = auth.uid())
  );

DROP POLICY IF EXISTS "Suppliers can view own orders" ON orders;
CREATE POLICY "Suppliers can view own orders"
  ON orders FOR SELECT
  USING (
    (get_account_type(auth.uid()) = 'supplier'::account_type)
    AND (supplier_id = auth.uid())
  );

DROP POLICY IF EXISTS "Suppliers can update own orders" ON orders;
CREATE POLICY "Suppliers can update own orders"
  ON orders FOR UPDATE
  USING (
    (get_account_type(auth.uid()) = 'supplier'::account_type)
    AND (supplier_id = auth.uid())
  )
  WITH CHECK (supplier_id = auth.uid());
