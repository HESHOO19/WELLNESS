-- Buyer personalization and supplier discovery

CREATE TABLE IF NOT EXISTS public.favorite_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.favorite_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorite_products;
CREATE POLICY "Users can view own favorites"
  ON public.favorite_products FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorite_products;
CREATE POLICY "Users can manage own favorites"
  ON public.favorite_products FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.supplier_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, supplier_id),
  CHECK (user_id <> supplier_id)
);

ALTER TABLE public.supplier_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own supplier subscriptions" ON public.supplier_subscriptions;
CREATE POLICY "Users can view own supplier subscriptions"
  ON public.supplier_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own supplier subscriptions" ON public.supplier_subscriptions;
CREATE POLICY "Users can manage own supplier subscriptions"
  ON public.supplier_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'stay-informed',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view own newsletter subscriptions" ON public.newsletter_subscriptions;
CREATE POLICY "Authenticated users can view own newsletter subscriptions"
  ON public.newsletter_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can subscribe to the newsletter" ON public.newsletter_subscriptions;
CREATE POLICY "Anyone can subscribe to the newsletter"
  ON public.newsletter_subscriptions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own newsletter subscriptions" ON public.newsletter_subscriptions;
CREATE POLICY "Users can update own newsletter subscriptions"
  ON public.newsletter_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_products_user_created_at
  ON public.favorite_products (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_subscriptions_user_created_at
  ON public.supplier_subscriptions (user_id, created_at DESC);

DROP POLICY IF EXISTS "Authenticated users can read supplier profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read supplier profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (account_type = 'supplier');
