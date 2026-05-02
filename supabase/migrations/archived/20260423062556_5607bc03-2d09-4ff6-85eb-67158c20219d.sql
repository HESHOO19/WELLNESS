
DROP POLICY IF EXISTS "Anyone can update own subscription" ON public.newsletter_subscriptions;
CREATE POLICY "Owner can update own subscription" ON public.newsletter_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
