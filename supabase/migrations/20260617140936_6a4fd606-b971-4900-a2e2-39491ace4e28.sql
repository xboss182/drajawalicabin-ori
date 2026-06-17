
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'owner', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending_payment','awaiting_review','confirmed','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ user_roles ============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ cabins ============
CREATE TABLE IF NOT EXISTS public.cabins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  cabin_type text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0 AND capacity < 20),
  weekday_rate numeric(10,2) NOT NULL CHECK (weekday_rate >= 0),
  weekend_rate numeric(10,2) NOT NULL CHECK (weekend_rate >= 0),
  school_holiday_rate numeric(10,2) NOT NULL CHECK (school_holiday_rate >= 0),
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cabins TO anon, authenticated;
GRANT ALL ON public.cabins TO service_role;
ALTER TABLE public.cabins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cabins readable by all" ON public.cabins;
CREATE POLICY "Cabins readable by all" ON public.cabins
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage cabins" ON public.cabins;
CREATE POLICY "Admins manage cabins" ON public.cabins
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed 8 cabins
INSERT INTO public.cabins (slug, name, cabin_type, capacity, weekday_rate, weekend_rate, school_holiday_rate, description, display_order) VALUES
  ('queen-1','Riverside Queen 1','Queen',2,80,90,100,'Queen bed cabin for 2.',1),
  ('queen-2','Riverside Queen 2','Queen',2,80,90,100,'Queen bed cabin for 2.',2),
  ('twin-1','Garden Twin 1','Twin',2,80,90,100,'Twin bed cabin for 2.',3),
  ('twin-2','Garden Twin 2','Twin',2,80,90,100,'Twin bed cabin for 2.',4),
  ('triple-1','Family Triple 1','Triple',3,120,130,150,'Family room for up to 3.',5),
  ('triple-2','Family Triple 2','Triple',3,120,130,150,'Family room for up to 3.',6),
  ('family-1','Family Suite 1','Family',4,150,160,180,'Family room for up to 4.',7),
  ('family-2','Family Suite 2','Family',4,150,160,180,'Family room for up to 4.',8)
ON CONFLICT (slug) DO NOTHING;

-- ============ school_holidays ============
CREATE TABLE IF NOT EXISTS public.school_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_holidays TO anon, authenticated;
GRANT ALL ON public.school_holidays TO service_role;
ALTER TABLE public.school_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Holidays readable" ON public.school_holidays;
CREATE POLICY "Holidays readable" ON public.school_holidays
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage holidays" ON public.school_holidays;
CREATE POLICY "Admins manage holidays" ON public.school_holidays
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ booking_requests changes ============
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS cabin_id uuid REFERENCES public.cabins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nights integer,
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2),
  ADD COLUMN IF NOT EXISTS comforter boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comforter_total numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_reference text UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_proof_path text,
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- migrate status column from text to enum, default pending_payment
ALTER TABLE public.booking_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.booking_requests
  ALTER COLUMN status TYPE public.booking_status
  USING CASE
    WHEN status IN ('pending_payment','awaiting_review','confirmed','cancelled','expired')
      THEN status::public.booking_status
    ELSE 'pending_payment'::public.booking_status
  END;
ALTER TABLE public.booking_requests ALTER COLUMN status SET DEFAULT 'pending_payment';

-- Index for fast availability lookup
CREATE INDEX IF NOT EXISTS booking_requests_cabin_dates_idx
  ON public.booking_requests (cabin_id, check_in, check_out)
  WHERE status IN ('pending_payment','awaiting_review','confirmed');

-- New RLS: anon insert with broader checks (need to allow new fields)
DROP POLICY IF EXISTS "Anyone can submit a booking request" ON public.booking_requests;
CREATE POLICY "Submit booking request" ON public.booking_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(guest_name) BETWEEN 1 AND 100 AND
    char_length(email) BETWEEN 3 AND 255 AND
    char_length(phone) BETWEEN 5 AND 30 AND
    guests BETWEEN 1 AND 12 AND
    check_out > check_in AND
    char_length(COALESCE(notes,'')) <= 1000 AND
    status = 'pending_payment'
  );

-- Allow anon UPDATE only to attach payment proof for own pending booking referenced by id+reference
-- Safer: do via server function. Skip anon update; require server fn with service role.

-- Admins read & manage
DROP POLICY IF EXISTS "Admins read bookings" ON public.booking_requests;
CREATE POLICY "Admins read bookings" ON public.booking_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins update bookings" ON public.booking_requests;
CREATE POLICY "Admins update bookings" ON public.booking_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ helper: dates taken per cabin ============
CREATE OR REPLACE FUNCTION public.cabin_taken_dates(_cabin_id uuid, _from date, _to date)
RETURNS TABLE(d date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gs::date
  FROM public.booking_requests b
  CROSS JOIN LATERAL generate_series(b.check_in, b.check_out - 1, interval '1 day') gs
  WHERE b.cabin_id = _cabin_id
    AND b.status IN ('confirmed','awaiting_review')
    AND gs::date BETWEEN _from AND _to
  UNION
  SELECT gs::date
  FROM public.booking_requests b
  CROSS JOIN LATERAL generate_series(b.check_in, b.check_out - 1, interval '1 day') gs
  WHERE b.cabin_id = _cabin_id
    AND b.status = 'pending_payment'
    AND COALESCE(b.hold_expires_at, b.created_at + interval '30 minutes') > now()
    AND gs::date BETWEEN _from AND _to;
$$;
GRANT EXECUTE ON FUNCTION public.cabin_taken_dates(uuid,date,date) TO anon, authenticated;

-- ============ helper: price computation ============
CREATE OR REPLACE FUNCTION public.compute_booking_price(_cabin_id uuid, _check_in date, _check_out date, _comforter boolean)
RETURNS TABLE(nights integer, subtotal numeric, comforter_total numeric, total numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.cabins%ROWTYPE;
  d date;
  rate numeric := 0;
  sub numeric := 0;
  n integer := 0;
  is_school boolean;
  dow integer;
BEGIN
  SELECT * INTO c FROM public.cabins WHERE id = _cabin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cabin not found'; END IF;
  IF _check_out <= _check_in THEN RAISE EXCEPTION 'Invalid dates'; END IF;

  d := _check_in;
  WHILE d < _check_out LOOP
    SELECT EXISTS (SELECT 1 FROM public.school_holidays WHERE d BETWEEN starts_on AND ends_on) INTO is_school;
    dow := EXTRACT(ISODOW FROM d); -- 1=Mon..7=Sun
    IF is_school THEN
      rate := c.school_holiday_rate;
    ELSIF dow >= 5 THEN -- Fri(5), Sat(6), Sun(7)
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
END $$;
GRANT EXECUTE ON FUNCTION public.compute_booking_price(uuid,date,date,boolean) TO anon, authenticated;
