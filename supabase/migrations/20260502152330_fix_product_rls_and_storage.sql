-- Fix product RLS policies and ensure product-images storage bucket exists.

-- Ensure the product-images storage bucket exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Suppliers can upload product images" ON storage.objects;
CREATE POLICY "Suppliers can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Suppliers can update own product images" ON storage.objects;
CREATE POLICY "Suppliers can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Suppliers can delete own product images" ON storage.objects;
CREATE POLICY "Suppliers can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Simplify product RLS policies to rely on supplier_id enforcement.
DROP POLICY IF EXISTS "Suppliers can insert own products" ON public.products;
CREATE POLICY "Suppliers can insert own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
  supplier_id = auth.uid()
);

DROP POLICY IF EXISTS "Suppliers can update own products" ON public.products;
CREATE POLICY "Suppliers can update own products"
ON public.products FOR UPDATE TO authenticated
USING (supplier_id = auth.uid())
WITH CHECK (supplier_id = auth.uid());

DROP POLICY IF EXISTS "Suppliers can delete own products" ON public.products;
CREATE POLICY "Suppliers can delete own products"
ON public.products FOR DELETE TO authenticated
USING (supplier_id = auth.uid());
