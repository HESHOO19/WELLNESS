
-- 1. Extend orders with supplier columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_name text;

CREATE INDEX IF NOT EXISTS idx_orders_supplier_id ON public.orders(supplier_id);

-- 2. favorite_products
CREATE TABLE IF NOT EXISTS public.favorite_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.favorite_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites select" ON public.favorite_products
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own favorites insert" ON public.favorite_products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own favorites delete" ON public.favorite_products
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. supplier_subscriptions
CREATE TABLE IF NOT EXISTS public.supplier_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_id)
);

ALTER TABLE public.supplier_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subs select" ON public.supplier_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own subs insert" ON public.supplier_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own subs delete" ON public.supplier_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. newsletter_subscriptions
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  user_id uuid,
  source text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can subscribe / upsert their email
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update own subscription" ON public.newsletter_subscriptions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owners can read own subscription" ON public.newsletter_subscriptions
  FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());

-- 5. place_order RPC
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
  v_user uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_product public.products%ROWTYPE;
  v_supplier_id uuid;
  v_supplier_ids uuid[] := ARRAY[]::uuid[];
  v_total numeric := 0;
  v_order public.orders%ROWTYPE;
  v_supplier_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF items IS NULL OR jsonb_array_length(items) = 0 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::int, 0);
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_product_id AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid or inactive product';
    END IF;
    IF v_product.stock < v_quantity THEN
      RAISE EXCEPTION 'insufficient stock for %', v_product.name;
    END IF;
    IF v_quantity < v_product.min_order THEN
      RAISE EXCEPTION 'minimum order quantity not met for %', v_product.name;
    END IF;
    IF v_product.supplier_id IS NULL THEN
      RAISE EXCEPTION 'missing supplier for product %', v_product.name;
    END IF;

    v_supplier_ids := array_append(v_supplier_ids, v_product.supplier_id);
    v_total := v_total + (v_product.price * v_quantity);
  END LOOP;

  -- single supplier check
  IF (SELECT COUNT(DISTINCT s) FROM unnest(v_supplier_ids) s) > 1 THEN
    RAISE EXCEPTION 'multiple suppliers in one order';
  END IF;

  v_supplier_id := v_supplier_ids[1];
  SELECT COALESCE(NULLIF(business_name, ''), email) INTO v_supplier_name
    FROM public.profiles WHERE id = v_supplier_id;

  INSERT INTO public.orders (
    user_id, total, payment_method, status,
    delivery_address, delivery_city, delivery_phone, notes,
    supplier_id, supplier_name
  ) VALUES (
    v_user, v_total, payment_method, 'pending',
    delivery_address, delivery_city, delivery_phone, notes,
    v_supplier_id, v_supplier_name
  ) RETURNING * INTO v_order;

  -- Insert items + decrement stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;
    SELECT * INTO v_product FROM public.products WHERE id = v_product_id;

    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order.id, v_product_id, v_quantity, v_product.price);

    UPDATE public.products SET stock = stock - v_quantity WHERE id = v_product_id;
  END LOOP;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, public.payment_method, text, text, text, text) TO authenticated;

-- Update orders RLS for supplier visibility via supplier_id column
DROP POLICY IF EXISTS "Suppliers can view orders by supplier_id" ON public.orders;
CREATE POLICY "Suppliers can view orders by supplier_id" ON public.orders
  FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can update orders by supplier_id" ON public.orders;
CREATE POLICY "Suppliers can update orders by supplier_id" ON public.orders
  FOR UPDATE TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());
