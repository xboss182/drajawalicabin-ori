ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'deposit'
  CHECK (payment_type IN ('deposit','full'));

UPDATE public.booking_requests SET payment_type = 'deposit' WHERE payment_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_booking_requests_payment_type ON public.booking_requests(payment_type);