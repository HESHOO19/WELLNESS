-- Ensure every product inserted by an authenticated supplier is assigned the current user as supplier_id.

CREATE OR REPLACE FUNCTION public.set_product_supplier_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NEW.supplier_id IS NULL THEN
    NEW.supplier_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_product_supplier_id ON public.products;
CREATE TRIGGER set_product_supplier_id
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_product_supplier_id();
