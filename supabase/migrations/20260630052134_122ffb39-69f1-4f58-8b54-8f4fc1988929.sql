-- Balance due date on booking_requests
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS balance_due_at timestamptz;

-- Backfill: check_in - 7 days for active reservations missing a due date
UPDATE public.booking_requests
   SET balance_due_at = (check_in - INTERVAL '7 days')
 WHERE balance_due_at IS NULL
   AND status IN ('confirmed','fully_paid','awaiting_review','pending_payment');

-- Admin email recipients (multi-recipient, editable)
CREATE TABLE IF NOT EXISTS public.admin_email_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  label text,
  notify_new_booking boolean NOT NULL DEFAULT true,
  notify_payment_proof boolean NOT NULL DEFAULT true,
  notify_fully_paid boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_recipients_email_lower_unique UNIQUE (email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_email_recipients TO authenticated;
GRANT ALL ON public.admin_email_recipients TO service_role;

ALTER TABLE public.admin_email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage recipients"
  ON public.admin_email_recipients
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- App settings (key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage app settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed payment settings
INSERT INTO public.app_settings(key, value) VALUES
  ('deposit_amount_default', '50'::jsonb),
  ('balance_due_days_before', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed admin recipients from the existing hard-coded TEAM_CC list
INSERT INTO public.admin_email_recipients(email, label) VALUES
  ('awang.mfauzi@gmail.com', 'Owner'),
  ('salikin1305@gmail.com', 'Team'),
  ('xboss182@gmail.com', 'Team')
ON CONFLICT (email) DO NOTHING;

-- updated_at trigger fn (reuse if present)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_email_recipients_updated_at ON public.admin_email_recipients;
CREATE TRIGGER admin_email_recipients_updated_at
  BEFORE UPDATE ON public.admin_email_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();