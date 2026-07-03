
ALTER TABLE public.school_holidays
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'school_break'
  CHECK (kind IN ('public_holiday', 'school_break'));

-- Reclassify existing rows: labels starting with "School Holiday" are breaks,
-- everything else is a federal/public holiday.
UPDATE public.school_holidays
SET kind = CASE
  WHEN label ILIKE 'School Holiday%' THEN 'school_break'
  ELSE 'public_holiday'
END;

-- Update pricing: public holidays use weekend rate; school breaks use school_holiday_rate.
CREATE OR REPLACE FUNCTION public.compute_booking_price(_cabin_id uuid, _check_in date, _check_out date, _comforter boolean)
 RETURNS TABLE(nights integer, subtotal numeric, comforter_total numeric, total numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.cabins%ROWTYPE;
  d date;
  rate numeric := 0;
  sub numeric := 0;
  n integer := 0;
  is_public_holiday boolean;
  is_school_break boolean;
  dow integer;
BEGIN
  SELECT * INTO c FROM public.cabins WHERE id = _cabin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cabin not found'; END IF;
  IF _check_out <= _check_in THEN RAISE EXCEPTION 'Invalid dates'; END IF;

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
    dow := EXTRACT(ISODOW FROM d); -- 1=Mon..7=Sun

    IF is_school_break THEN
      rate := c.school_holiday_rate;
    ELSIF is_public_holiday THEN
      rate := c.weekend_rate;
    ELSIF dow >= 5 THEN
      rate := c.weekend_rate;
    ELSE
      rate := c.weekday_rate;
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
END $function$;
