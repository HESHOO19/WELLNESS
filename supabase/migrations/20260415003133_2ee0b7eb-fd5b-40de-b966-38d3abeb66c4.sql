
-- Create account type enum
CREATE TYPE public.account_type AS ENUM ('supplier', 'buyer');

-- Add account_type to profiles
ALTER TABLE public.profiles ADD COLUMN account_type public.account_type NOT NULL DEFAULT 'buyer';

-- Add supplier_id to products so each product belongs to a supplier
ALTER TABLE public.products ADD COLUMN supplier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update the trigger function to include account_type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, business_name, phone, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'business_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'buyer')::public.account_type
  );
  RETURN NEW;
END;
$$;

-- Security definer function to check account type (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_account_type(_user_id uuid)
RETURNS public.account_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_type FROM public.profiles WHERE id = _user_id
$$;

-- Allow suppliers to manage their own products
CREATE POLICY "Suppliers can insert own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    public.get_account_type(auth.uid()) = 'supplier'
    AND supplier_id = auth.uid()
  );

CREATE POLICY "Suppliers can update own products"
  ON public.products FOR UPDATE TO authenticated
  USING (supplier_id = auth.uid() AND public.get_account_type(auth.uid()) = 'supplier')
  WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "Suppliers can delete own products"
  ON public.products FOR DELETE TO authenticated
  USING (supplier_id = auth.uid() AND public.get_account_type(auth.uid()) = 'supplier');

-- Let suppliers see orders that contain their products
CREATE POLICY "Suppliers can view orders with their products"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.get_account_type(auth.uid()) = 'supplier'
    AND EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = orders.id AND p.supplier_id = auth.uid()
    )
  );

-- Let suppliers see order items for their products
CREATE POLICY "Suppliers can view their order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = order_items.product_id AND p.supplier_id = auth.uid()
    )
  );
