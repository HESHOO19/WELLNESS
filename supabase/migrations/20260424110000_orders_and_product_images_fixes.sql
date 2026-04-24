-- 1) Fix place_order uuid aggregation for single-supplier checkout
-- 2) Add multi-image support on products via image_urls text[]

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill image_urls from existing image_url for legacy rows.
UPDATE public.products
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

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
  requested_count integer;
  priced_count integer;
  total_amount numeric;
  has_low_qty boolean;
  has_bad_qty boolean;
  has_low_stock boolean;
  has_missing_supplier boolean;
  supplier_count integer;
  order_supplier_id uuid;
  order_supplier_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF items IS NULL THEN
    RAISE EXCEPTION 'No items in order';
  END IF;

  WITH requested AS (
    SELECT
      (item->>'product_id')::uuid AS product_id,
      (item->>'quantity')::int AS quantity
    FROM jsonb_array_elements(items) AS item
  ),
  normalized AS (
    SELECT product_id, sum(quantity) AS quantity
    FROM requested
    GROUP BY product_id
  ),
  locked AS (
    SELECT
      p.id,
      p.price,
      p.min_order,
      p.stock,
      p.supplier_id,
      COALESCE(pr.business_name, pr.email, 'Supplier') AS supplier_name
    FROM public.products p
    JOIN normalized n ON n.product_id = p.id
    LEFT JOIN public.profiles pr ON pr.id = p.supplier_id
    WHERE p.is_active = true
    FOR UPDATE
  )
  SELECT
    (SELECT count(*) FROM normalized),
    (SELECT count(*) FROM locked),
    (SELECT sum(l.price * n.quantity) FROM normalized n JOIN locked l ON l.id = n.product_id),
    (SELECT bool_or(n.quantity < l.min_order) FROM normalized n JOIN locked l ON l.id = n.product_id),
    (SELECT bool_or(n.quantity IS NULL OR n.quantity < 1) FROM normalized n),
    (SELECT bool_or(n.quantity > COALESCE(l.stock, 0)) FROM normalized n JOIN locked l ON l.id = n.product_id),
    (SELECT bool_or(l.supplier_id IS NULL) FROM locked l),
    (SELECT count(DISTINCT supplier_id) FROM locked),
    (SELECT max(supplier_id::text)::uuid FROM locked),
    (SELECT max(supplier_name) FROM locked)
  INTO requested_count, priced_count, total_amount, has_low_qty, has_bad_qty, has_low_stock,
       has_missing_supplier, supplier_count, order_supplier_id, order_supplier_name;

  IF requested_count IS NULL OR requested_count = 0 THEN
    RAISE EXCEPTION 'No items in order';
  END IF;

  IF priced_count <> requested_count THEN
    RAISE EXCEPTION 'One or more products are invalid or inactive';
  END IF;

  IF has_bad_qty THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  IF has_low_qty THEN
    RAISE EXCEPTION 'Minimum order quantity not met';
  END IF;

  IF has_low_stock THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  IF has_missing_supplier THEN
    RAISE EXCEPTION 'Missing supplier information for one or more items';
  END IF;

  IF supplier_count <> 1 THEN
    RAISE EXCEPTION 'Order contains items from multiple suppliers';
  END IF;

  INSERT INTO public.orders (
    user_id,
    total,
    payment_method,
    delivery_address,
    delivery_city,
    delivery_phone,
    notes,
    supplier_id,
    supplier_name
  )
  VALUES (
    auth.uid(),
    COALESCE(total_amount, 0),
    payment_method,
    delivery_address,
    delivery_city,
    delivery_phone,
    notes,
    order_supplier_id,
    order_supplier_name
  )
  RETURNING * INTO order_row;

  WITH requested AS (
    SELECT
      (item->>'product_id')::uuid AS product_id,
      (item->>'quantity')::int AS quantity
    FROM jsonb_array_elements(items) AS item
  ),
  normalized AS (
    SELECT product_id, sum(quantity) AS quantity
    FROM requested
    GROUP BY product_id
  ),
  locked AS (
    SELECT p.id, p.price
    FROM public.products p
    JOIN normalized n ON n.product_id = p.id
    WHERE p.is_active = true
  )
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
  SELECT
    order_row.id,
    n.product_id,
    n.quantity,
    l.price
  FROM normalized n
  JOIN locked l ON l.id = n.product_id;

  WITH requested AS (
    SELECT
      (item->>'product_id')::uuid AS product_id,
      (item->>'quantity')::int AS quantity
    FROM jsonb_array_elements(items) AS item
  ),
  normalized AS (
    SELECT product_id, sum(quantity) AS quantity
    FROM requested
    GROUP BY product_id
  )
  UPDATE public.products p
  SET stock = p.stock - n.quantity
  FROM normalized n
  WHERE p.id = n.product_id;

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
