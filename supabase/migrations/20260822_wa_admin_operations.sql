-- Admin-only WhatsApp operations state (MNC-963).
-- Browser clients remain RLS-constrained; privileged writes happen only in
-- authenticated server functions or the HMAC-authenticated bridge API.

CREATE TABLE IF NOT EXISTS public.wa_runtime_status (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  state text NOT NULL,
  session text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);

CREATE TABLE IF NOT EXISTS public.wa_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_group_id uuid,
  chat_id text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_admin_audit_booking_idx
  ON public.wa_admin_audit (booking_group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_admin_audit_chat_idx
  ON public.wa_admin_audit (chat_id, created_at DESC);

ALTER TABLE public.wa_runtime_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_admin_audit ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_runtime_status TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_admin_audit TO service_role;

DROP POLICY IF EXISTS "Admins read wa runtime" ON public.wa_runtime_status;
CREATE POLICY "Admins read wa runtime" ON public.wa_runtime_status
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read wa audit" ON public.wa_admin_audit;
CREATE POLICY "Admins read wa audit" ON public.wa_admin_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
