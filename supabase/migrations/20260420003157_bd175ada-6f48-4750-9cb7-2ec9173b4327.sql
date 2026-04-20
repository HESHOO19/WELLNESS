-- Drop the broad listing policy
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;

-- Make the bucket non-listable but keep files publicly accessible via URL
UPDATE storage.buckets SET public = true WHERE id = 'product-images';
-- Public buckets serve files directly via the CDN without requiring a SELECT
-- policy on storage.objects, so no replacement policy is needed.
