
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_balance_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_balance_payment_intent_id text;

ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_payment_method_chk
  CHECK (payment_method IN ('manual','stripe'));

CREATE INDEX IF NOT EXISTS idx_booking_requests_stripe_session
  ON public.booking_requests(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_stripe_balance_session
  ON public.booking_requests(stripe_balance_session_id);
