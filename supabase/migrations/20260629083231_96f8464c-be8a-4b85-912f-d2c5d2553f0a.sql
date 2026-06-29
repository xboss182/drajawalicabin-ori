CREATE OR REPLACE FUNCTION public.cabin_taken_dates(_cabin_id uuid, _from date, _to date)
RETURNS TABLE(d date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested_cabin AS (
    SELECT id, cabin_type
    FROM public.cabins
    WHERE id = _cabin_id
  ),
  active_bookings AS (
    SELECT
      b.id,
      b.cabin_id,
      b.check_in,
      b.check_out,
      COALESCE(b.num_rooms, 1) AS num_rooms,
      c.cabin_type
    FROM public.booking_requests b
    JOIN public.cabins c ON c.id = b.cabin_id
    WHERE
      b.status IN ('confirmed','awaiting_review','fully_paid')
      OR (
        b.status = 'pending_payment'
        AND COALESCE(b.hold_expires_at, b.created_at + interval '30 minutes') > now()
      )
  ),
  type_inventory AS (
    SELECT c.cabin_type, count(*)::integer AS room_count
    FROM public.cabins c
    WHERE c.is_active
    GROUP BY c.cabin_type
  )
  SELECT gs::date
  FROM active_bookings b
  JOIN requested_cabin r ON b.cabin_id = r.id
  CROSS JOIN LATERAL generate_series(b.check_in, b.check_out - 1, interval '1 day') gs
  WHERE gs::date BETWEEN _from AND _to

  UNION

  SELECT gs::date
  FROM active_bookings b
  JOIN requested_cabin r ON b.cabin_type = r.cabin_type
  JOIN type_inventory i ON i.cabin_type = r.cabin_type
  CROSS JOIN LATERAL generate_series(b.check_in, b.check_out - 1, interval '1 day') gs
  WHERE b.num_rooms >= i.room_count
    AND gs::date BETWEEN _from AND _to;
$$;

REVOKE EXECUTE ON FUNCTION public.cabin_taken_dates(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cabin_taken_dates(uuid, date, date) TO service_role;