
-- 1) Revoke EXECUTE on SECURITY DEFINER helpers from anon/authenticated/public.
REVOKE EXECUTE ON FUNCTION public.compute_booking_price(uuid, date, date, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cabin_taken_dates(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_booking_price(uuid, date, date, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cabin_taken_dates(uuid, date, date) TO service_role;
-- has_role stays callable by authenticated (used in RLS predicates / role checks).

-- 2) Add explicit guest SELECT policy on booking_requests gated by an x-guest-token header.
DROP POLICY IF EXISTS "Guests read own booking by guest_token" ON public.booking_requests;
CREATE POLICY "Guests read own booking by guest_token"
  ON public.booking_requests
  FOR SELECT
  TO anon, authenticated
  USING (
    guest_token IS NOT NULL
    AND guest_token = NULLIF(
      current_setting('request.headers', true)::json ->> 'x-guest-token',
      ''
    )::uuid
  );
GRANT SELECT ON public.booking_requests TO anon, authenticated;

-- 3) Tighten payment-proofs upload policy: require the booking_id in the path to exist
--    and still be in a state that accepts proofs.
DROP POLICY IF EXISTS "Guests upload payment proof to booking folder" ON storage.objects;
CREATE POLICY "Guests upload payment proof to booking folder"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND name ~ '^bookings/[0-9a-f-]{36}/[A-Za-z0-9._/-]+$'
    AND octet_length(name) <= 300
    AND EXISTS (
      SELECT 1 FROM public.booking_requests b
      WHERE b.id = (substring(name from '^bookings/([0-9a-f-]{36})/'))::uuid
        AND b.status IN ('pending_payment', 'awaiting_review', 'confirmed', 'fully_paid')
    )
  );
