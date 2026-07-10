
-- Discount type enum
CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed', 'nth_night');
CREATE TYPE public.discount_scope AS ENUM ('any', 'weekday', 'weekend', 'holiday');

-- discounts table
CREATE TABLE public.discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE,                       -- null = automatic rule
  name TEXT NOT NULL,
  description TEXT,
  type public.discount_type NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,       -- percent (0-100), fixed RM, or nth-night index
  nth_night_percent NUMERIC,              -- for nth_night: how much % OFF that night (100 = free)
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,                  -- coupon validity window
  ends_at TIMESTAMPTZ,
  stay_from DATE,                         -- eligible check-in window
  stay_to DATE,
  min_nights INTEGER NOT NULL DEFAULT 1,
  min_rooms INTEGER NOT NULL DEFAULT 1,
  min_subtotal NUMERIC NOT NULL DEFAULT 0,
  cabin_types TEXT[] NOT NULL DEFAULT '{}',
  applies_to public.discount_scope NOT NULL DEFAULT 'any',
  max_uses INTEGER,
  max_uses_per_email INTEGER,
  stackable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discounts TO authenticated;
GRANT ALL ON public.discounts TO service_role;

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage discounts"
  ON public.discounts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER discounts_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX discounts_code_idx ON public.discounts (code) WHERE code IS NOT NULL;
CREATE INDEX discounts_active_idx ON public.discounts (active) WHERE active = true;

-- discount_redemptions table
CREATE TABLE public.discount_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_id UUID NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  booking_group_id UUID NOT NULL,
  email TEXT,
  amount_off NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.discount_redemptions TO authenticated;
GRANT ALL ON public.discount_redemptions TO service_role;

ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read redemptions"
  ON public.discount_redemptions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX discount_redemptions_discount_idx ON public.discount_redemptions (discount_id);
CREATE INDEX discount_redemptions_group_idx ON public.discount_redemptions (booking_group_id);
CREATE INDEX discount_redemptions_email_idx ON public.discount_redemptions (email);

-- Add discount tracking columns to booking_requests (per group; stored on lead row)
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES public.discounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;
