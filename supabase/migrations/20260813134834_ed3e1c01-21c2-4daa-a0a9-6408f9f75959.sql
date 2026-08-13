CREATE OR REPLACE FUNCTION public.compute_booking_price(_cabin_id uuid, _check_in date, _check_out date, _comforter boolean)
RETURNS TABLE(nights integer, subtotal numeric, comforter_total numeric, total numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.cabins%ROWTYPE;
  d date;
  rate numeric := 0;
  sub numeric := 0;
  n integer := 0;
  is_public_holiday boolean;
  is_school_break boolean;
  dow integer;
  use_legacy boolean := false;
  r_weekday numeric;
  r_weekend numeric;
  r_holiday numeric;
BEGIN
  SELECT * INTO c FROM public.cabins WHERE id = _cabin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cabin not found'; END IF;
  IF _check_out <= _check_in THEN RAISE EXCEPTION 'Invalid dates'; END IF;

  SELECT (value #>> '{}') = 'legacy' INTO use_legacy
  FROM public.app_settings WHERE key = 'active_rate_set';
  use_legacy := COALESCE(use_legacy, false);

  IF use_legacy THEN
    r_weekday := COALESCE(c.legacy_weekday_rate, c.weekday_rate);
    r_weekend := COALESCE(c.legacy_weekend_rate, c.weekend_rate);
    r_holiday := COALESCE(c.legacy_school_holiday_rate, c.school_holiday_rate);
  ELSE
    r_weekday := c.weekday_rate;
    r_weekend := c.weekend_rate;
    r_holiday := c.school_holiday_rate;
  END IF;

  d := _check_in;
  WHILE d < _check_out LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.school_holidays
      WHERE kind = 'public_holiday' AND d BETWEEN starts_on AND ends_on
    ) INTO is_public_holiday;
    SELECT EXISTS (
      SELECT 1 FROM public.school_holidays
      WHERE kind = 'school_break' AND d BETWEEN starts_on AND ends_on
    ) INTO is_school_break;
    dow := EXTRACT(ISODOW FROM d);

    -- base: weekday/weekend by day of week
    IF dow >= 5 THEN
      rate := r_weekend;
    ELSE
      rate := r_weekday;
    END IF;
    -- public holiday: at least weekend rate
    IF is_public_holiday THEN
      rate := GREATEST(rate, r_weekend);
    END IF;
    -- school break: always the highest applicable rate
    IF is_school_break THEN
      rate := GREATEST(rate, r_holiday);
    END IF;

    sub := sub + rate;
    n := n + 1;
    d := d + 1;
  END LOOP;

  nights := n;
  subtotal := sub;
  comforter_total := CASE WHEN _comforter THEN 20 * n ELSE 0 END;
  total := sub + comforter_total;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.compute_booking_price(uuid, date, date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_booking_price(uuid, date, date, boolean) TO service_role;