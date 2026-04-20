-- Enforce stock validation and decrement during order placement

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
    SELECT p.id, p.price, p.min_order, p.stock
    FROM public.products p
    JOIN normalized n ON n.product_id = p.id
    WHERE p.is_active = true
    FOR UPDATE
  )
  SELECT
    (SELECT count(*) FROM normalized),
    (SELECT count(*) FROM locked),
    (SELECT sum(l.price * n.quantity) FROM normalized n JOIN locked l ON l.id = n.product_id),
    (SELECT bool_or(n.quantity < l.min_order) FROM normalized n JOIN locked l ON l.id = n.product_id),
    (SELECT bool_or(n.quantity IS NULL OR n.quantity < 1) FROM normalized n),
    (SELECT bool_or(n.quantity > COALESCE(l.stock, 0)) FROM normalized n JOIN locked l ON l.id = n.product_id)
  INTO requested_count, priced_count, total_amount, has_low_qty, has_bad_qty, has_low_stock;

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
