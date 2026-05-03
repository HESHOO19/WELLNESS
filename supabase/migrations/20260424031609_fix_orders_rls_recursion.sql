-- Fix infinite recursion in orders/order_items RLS policies.
--
-- Root cause:
-- - Some orders policies referenced order_items, while order_items policies
--   referenced orders, creating circular policy evaluation.
--
-- Keep access model simple and non-recursive:
-- - Buyer can read own orders + own order_items
-- - Supplier can read/update orders where orders.supplier_id = auth.uid()
-- - Supplier can read order_items for products they own

DROP POLICY IF EXISTS "Suppliers can view orders with their products" ON public.orders;
DROP POLICY IF EXISTS "Suppliers can update orders with their products" ON public.orders;

-- Ensure canonical supplier policies exist
DROP POLICY IF EXISTS "Suppliers can view own orders" ON public.orders;
CREATE POLICY "Suppliers can view own orders"
  ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.get_account_type(auth.uid()) = 'supplier'
    AND supplier_id = auth.uid()
  );

DROP POLICY IF EXISTS "Suppliers can update own orders" ON public.orders;
CREATE POLICY "Suppliers can update own orders"
  ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.get_account_type(auth.uid()) = 'supplier'
    AND supplier_id = auth.uid()
  )
  WITH CHECK (supplier_id = auth.uid());

-- Keep status-only updates for authenticated users.
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE (status) ON public.orders TO authenticated;
