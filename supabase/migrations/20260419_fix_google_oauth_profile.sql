-- Fix handle_new_user to populate business_name from Google full_name for OAuth users
-- and ensure account_type defaults gracefully for OAuth signups

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
    COALESCE(
      NEW.raw_user_meta_data->>'business_name',
      NEW.raw_user_meta_data->>'full_name',   -- Google OAuth provides full_name
      NEW.raw_user_meta_data->>'name',         -- fallback
      ''
    ),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    -- For Google OAuth users, default to 'buyer'; they will update via the modal
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'buyer')::public.account_type
  )
  ON CONFLICT (id) DO NOTHING;  -- Safe re-run guard
  RETURN NEW;
END;
$$;
