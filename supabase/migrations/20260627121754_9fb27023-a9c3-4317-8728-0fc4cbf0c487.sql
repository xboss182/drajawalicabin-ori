
-- 1) guest_token on booking_requests
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS guest_token uuid NOT NULL DEFAULT gen_random_uuid();

-- 2) Restrict payment-proofs uploads to bookings/<uuid>/ prefix
DROP POLICY IF EXISTS "Anyone can upload payment proof" ON storage.objects;
CREATE POLICY "Guests upload payment proof to booking folder"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND name ~ '^bookings/[0-9a-f-]{36}/[A-Za-z0-9._/-]+$'
    AND octet_length(name) <= 300
  );

-- 3) Revoke EXECUTE from public roles on SECURITY DEFINER functions.
--    has_role: kept for authenticated (used by server fns via user-scoped client),
--    revoked from anon and public.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- cabin_taken_dates & compute_booking_price: only callable by service_role
REVOKE ALL ON FUNCTION public.cabin_taken_dates(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cabin_taken_dates(uuid, date, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cabin_taken_dates(uuid, date, date) TO service_role;

REVOKE ALL ON FUNCTION public.compute_booking_price(uuid, date, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_booking_price(uuid, date, date, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_booking_price(uuid, date, date, boolean) TO service_role;
