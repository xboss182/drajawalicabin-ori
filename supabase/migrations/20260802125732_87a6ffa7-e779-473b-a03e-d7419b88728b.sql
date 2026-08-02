ALTER TABLE public.cabins
  ADD COLUMN IF NOT EXISTS legacy_weekday_rate numeric,
  ADD COLUMN IF NOT EXISTS legacy_weekend_rate numeric,
  ADD COLUMN IF NOT EXISTS legacy_school_holiday_rate numeric;

UPDATE public.cabins
SET legacy_weekday_rate = COALESCE(legacy_weekday_rate, weekday_rate),
    legacy_weekend_rate = COALESCE(legacy_weekend_rate, weekend_rate),
    legacy_school_holiday_rate = COALESCE(legacy_school_holiday_rate, school_holiday_rate);

UPDATE public.cabins
SET weekday_rate = legacy_weekday_rate + 10,
    weekend_rate = legacy_weekend_rate + 10,
    school_holiday_rate = legacy_school_holiday_rate + 10;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('active_rate_set', '"current"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;