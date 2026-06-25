
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS balance_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_proof_path text,
  ADD COLUMN IF NOT EXISTS balance_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS locker_code text;

CREATE OR REPLACE FUNCTION public.cabin_taken_dates(_cabin_id uuid, _from date, _to date)
 RETURNS TABLE(d date)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT gs::date
  FROM public.booking_requests b
  CROSS JOIN LATERAL generate_series(b.check_in, b.check_out - 1, interval '1 day') gs
  WHERE b.cabin_id = _cabin_id
    AND b.status IN ('confirmed','awaiting_review','fully_paid')
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

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  to_email text NOT NULL,
  cc_emails text[] NOT NULL DEFAULT ARRAY['awang.mfauzi@gmail.com','salikin1305@gmail.com','xboss182@gmail.com']::text[],
  subject text NOT NULL,
  body text NOT NULL,
  booking_id uuid REFERENCES public.booking_requests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_outbox TO service_role;
GRANT SELECT, UPDATE ON public.email_outbox TO authenticated;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read outbox" ON public.email_outbox;
CREATE POLICY "Admins read outbox" ON public.email_outbox
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update outbox" ON public.email_outbox;
CREATE POLICY "Admins update outbox" ON public.email_outbox
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
