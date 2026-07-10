ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS actual_check_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_checkout_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_checkout_fee numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_refunded_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS deposit_refund_note text,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz;