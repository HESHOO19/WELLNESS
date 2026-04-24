-- Backfill orders.supplier_id and orders.supplier_name for legacy rows.
--
-- Safe behavior:
-- - Only updates orders where a *single* distinct supplier_id can be inferred
--   from order_items -> products.
-- - Does NOT attempt to split historical multi-supplier orders.

WITH supplier_per_order AS (
  SELECT
    o.id AS order_id,
    COUNT(DISTINCT p.supplier_id) FILTER (WHERE p.supplier_id IS NOT NULL) AS supplier_count,
    MAX(p.supplier_id::text) FILTER (WHERE p.supplier_id IS NOT NULL)::uuid AS supplier_id
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.supplier_id IS NULL
  GROUP BY o.id
),
eligible AS (
  SELECT order_id, supplier_id
  FROM supplier_per_order
  WHERE supplier_count = 1 AND supplier_id IS NOT NULL
),
supplier_names AS (
  SELECT
    e.order_id,
    e.supplier_id,
    COALESCE(NULLIF(pr.business_name, ''), pr.email, 'Supplier') AS supplier_name
  FROM eligible e
  LEFT JOIN public.profiles pr ON pr.id = e.supplier_id
)
UPDATE public.orders o
SET
  supplier_id = s.supplier_id,
  supplier_name = s.supplier_name
FROM supplier_names s
WHERE o.id = s.order_id;

-- If supplier_id is already set but supplier_name is missing/blank, backfill the name.
UPDATE public.orders o
SET supplier_name = COALESCE(NULLIF(pr.business_name, ''), pr.email, 'Supplier')
FROM public.profiles pr
WHERE
  o.supplier_id IS NOT NULL
  AND (o.supplier_name IS NULL OR btrim(o.supplier_name) = '')
  AND pr.id = o.supplier_id;
