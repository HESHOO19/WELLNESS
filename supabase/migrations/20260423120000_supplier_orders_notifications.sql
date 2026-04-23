-- Add supplier_orders table for per-supplier status tracking

CREATE TABLE public.supplier_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, supplier_id)
);

ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own supplier orders"
  ON public.supplier_orders FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

CREATE POLICY "Suppliers can update own supplier orders"
  ON public.supplier_orders FOR UPDATE TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "Buyers can view supplier orders for their orders"
  ON public.supplier_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = supplier_orders.order_id AND o.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier_created_at
  ON public.supplier_orders (supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_order_id
  ON public.supplier_orders (order_id);

-- Prevent direct order status edits from clients; supplier_orders drives status
REVOKE UPDATE ON public.orders FROM authenticated;

CREATE TRIGGER update_supplier_orders_updated_at
  BEFORE UPDATE ON public.supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_order_status_from_suppliers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_order_id UUID;
  total_count INTEGER;
  cancelled_count INTEGER;
  has_pending BOOLEAN;
  has_confirmed BOOLEAN;
  has_shipped BOOLEAN;
  has_delivered BOOLEAN;
  next_status public.order_status;
BEGIN
  target_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    BOOL_OR(status = 'pending'),
    BOOL_OR(status = 'confirmed'),
    BOOL_OR(status = 'shipped'),
    BOOL_OR(status = 'delivered')
  INTO total_count, cancelled_count, has_pending, has_confirmed, has_shipped, has_delivered
  FROM public.supplier_orders
  WHERE order_id = target_order_id;

  IF total_count = 0 THEN
    next_status := 'pending';
  ELSIF cancelled_count = total_count THEN
    next_status := 'cancelled';
  ELSIF has_pending THEN
    next_status := 'pending';
  ELSIF has_confirmed THEN
    next_status := 'confirmed';
  ELSIF has_shipped THEN
    next_status := 'shipped';
  ELSIF has_delivered THEN
    next_status := 'delivered';
  ELSE
    next_status := 'pending';
  END IF;

  UPDATE public.orders
  SET status = next_status
  WHERE id = target_order_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS supplier_orders_status_sync ON public.supplier_orders;
CREATE TRIGGER supplier_orders_status_sync
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_from_suppliers();

-- Update place_order to insert supplier_orders entries
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
    SELECT p.id, p.price, p.min_order, p.stock, p.supplier_id
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
    (SELECT bool_or(n.quantity > COALESCE(l.stock, 0)) FROM normalized n JOIN locked l ON l.id = n.product_id),
    (SELECT bool_or(l.supplier_id IS NULL) FROM locked l)
  INTO requested_count, priced_count, total_amount, has_low_qty, has_bad_qty, has_low_stock, has_missing_supplier;

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
  ),
  suppliers AS (
    SELECT DISTINCT
      p.supplier_id,
      COALESCE(pr.business_name, pr.email, 'Supplier') AS supplier_name
    FROM normalized n
    JOIN public.products p ON p.id = n.product_id
    LEFT JOIN public.profiles pr ON pr.id = p.supplier_id
  )
  INSERT INTO public.supplier_orders (order_id, supplier_id, supplier_name)
  SELECT
    order_row.id,
    supplier_id,
    supplier_name
  FROM suppliers;

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
