
CREATE OR REPLACE FUNCTION public.booking_accepts_proof(_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_requests b
    WHERE b.id = _booking_id
      AND b.status IN ('pending_payment', 'awaiting_review', 'confirmed', 'fully_paid')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.booking_accepts_proof(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_accepts_proof(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Guests upload payment proof to booking folder" ON storage.objects;
CREATE POLICY "Guests upload payment proof to booking folder"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND name ~ '^bookings/[0-9a-f-]{36}/[A-Za-z0-9._/-]+$'
    AND octet_length(name) <= 300
    AND public.booking_accepts_proof((substring(name from '^bookings/([0-9a-f-]{36})/'))::uuid)
  );
