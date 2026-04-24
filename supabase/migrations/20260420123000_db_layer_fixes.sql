-- Policy, privilege, and RPC fixes

-- Products: restrict public read to active only
DROP POLICY IF EXISTS "Products are publicly readable" ON public.products;
CREATE POLICY "Products are publicly readable"
  ON public.products FOR SELECT
  USING (is_active = true);

-- Suppliers can read their own products (including inactive)
DROP POLICY IF EXISTS "Suppliers can view own products" ON public.products;
CREATE POLICY "Suppliers can view own products"
  ON public.products FOR SELECT TO authenticated
  USING (
    public.get_account_type(auth.uid()) = 'supplier'
    AND supplier_id = auth.uid()
  );

-- Orders: restrict updates to status column only
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE (status) ON public.orders TO authenticated;

-- Orders + items: ensure inserts go through secure function
REVOKE INSERT ON public.orders FROM authenticated;
REVOKE INSERT ON public.order_items FROM authenticated;

CREATE OR REPLACE FUNCTION public.place_order(
  items jsonb,
  payment_method public.payment_method,
  delivery_address text,
  delivery_city text,
  delivery_phone text,
  notes text DEFAULT NULL
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
  items_count integer;
  priced_count integer;
  total_amount numeric;
  has_low_qty boolean;
  has_bad_qty boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF items IS NULL THEN
    RAISE EXCEPTION 'No items in order';
  END IF;

  SELECT count(*) INTO items_count
  FROM jsonb_array_elements(items);

  IF items_count = 0 THEN
    RAISE EXCEPTION 'No items in order';
  END IF;

  WITH requested AS (
    SELECT
      (item->>'product_id')::uuid AS product_id,
      (item->>'quantity')::int AS quantity
    FROM jsonb_array_elements(items) AS item
  ),
  priced AS (
    SELECT
      r.product_id,
      r.quantity,
      p.price,
      p.min_order
    FROM requested r
    JOIN public.products p ON p.id = r.product_id
    WHERE p.is_active = true
  )
  SELECT
    count(*) AS priced_count,
    sum(price * quantity) AS total_amount,
    bool_or(quantity < min_order) AS has_low_qty,
    bool_or(quantity IS NULL OR quantity < 1) AS has_bad_qty
  INTO priced_count, total_amount, has_low_qty, has_bad_qty
  FROM priced;

  IF priced_count <> items_count THEN
    RAISE EXCEPTION 'One or more products are invalid or inactive';
  END IF;

  IF has_bad_qty THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  IF has_low_qty THEN
    RAISE EXCEPTION 'Minimum order quantity not met';
  END IF;

  INSERT INTO public.orders (
    user_id,
    total,
    payment_method,
    delivery_address,
    delivery_city,
    delivery_phone,
    notes
  )
  VALUES (
    auth.uid(),
    COALESCE(total_amount, 0),
    payment_method,
    delivery_address,
    delivery_city,
    delivery_phone,
    notes
  )
  RETURNING * INTO order_row;

  WITH requested AS (
    SELECT
      (item->>'product_id')::uuid AS product_id,
      (item->>'quantity')::int AS quantity
    FROM jsonb_array_elements(items) AS item
  ),
  priced AS (
    SELECT
      r.product_id,
      r.quantity,
      p.price
    FROM requested r
    JOIN public.products p ON p.id = r.product_id
    WHERE p.is_active = true
  )
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
  SELECT
    order_row.id,
    product_id,
    quantity,
    price
  FROM priced;

  RETURN order_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(
  jsonb,
  public.payment_method,
  text,
  text,
  text,
  text
) TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_products_supplier_created_at
  ON public.products (supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_active_created_at
  ON public.products (is_active, created_at DESC);
