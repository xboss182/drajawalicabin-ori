CREATE OR REPLACE FUNCTION public.booking_accepts_proof(_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_requests b
    WHERE b.id = _booking_id
      AND b.status IN ('pending_payment', 'awaiting_review', 'confirmed', 'fully_paid')
  )
$$;