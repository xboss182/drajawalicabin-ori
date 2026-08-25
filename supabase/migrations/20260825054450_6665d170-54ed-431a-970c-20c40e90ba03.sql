-- ============================================================================
-- WA booking bridge (MNC-961, parent MNC-960/MNC-953)
--
-- Lovable Cloud side of the WhatsApp-native booking flow.
-- The WAHA session and the conversation engine run on the VPS ("wa-bridge");
-- this schema is the source of truth: conversation state, webhook event
-- dedupe, atomic inventory holds, manual-payment proof lifecycle, staff
-- review/audit and reliable outbound messages (outbox).
--
-- All machine writes go through server functions in the app
-- (src/lib/wa/machine-handlers.server.ts) that authenticate with an
-- HMAC-signed machine request and write via service_role; the tables below
-- are RLS-locked so a browser client can never read or write them directly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. booking_requests: WA linkage
-- ---------------------------------------------------------------------------
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS wa_chat_id text;

CREATE INDEX IF NOT EXISTS booking_requests_wa_chat_id_idx
  ON public.booking_requests (wa_chat_id)
  WHERE wa_chat_id IS NOT NULL;

-- At most one live WA draft per chat: a second concurrent claim for the same
-- guest fails on this index, so two holds can never be stacked by one chat.
CREATE UNIQUE INDEX IF NOT EXISTS booking_requests_wa_chat_live_idx
  ON public.booking_requests (wa_chat_id)
  WHERE source = 'wa' AND status IN ('pending_payment', 'awaiting_review');

-- ---------------------------------------------------------------------------
-- 2. wa_conversations — conversational state machine state (one per chat)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_conversations (
  chat_id text PRIMARY KEY,
  state text NOT NULL DEFAULT 'MENU',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 0,
  booking_group_id uuid,
  lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'bm')),
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.wa_touch_conversation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS wa_conversations_touch ON public.wa_conversations;
CREATE TRIGGER wa_conversations_touch
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.wa_touch_conversation();

-- ---------------------------------------------------------------------------
-- 3. wa_events — inbound webhook idempotency + audit trail
--    event_id = unique WAHA envelope id (payload.id). Replays and out-of-order
--    deliveries collapse here before any state transition runs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_events (
  event_id text PRIMARY KEY,
  chat_id text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS wa_events_chat_idx ON public.wa_events (chat_id, received_at);

-- ---------------------------------------------------------------------------
-- 4. wa_outbox — idempotent, replayable, restart-safe outbound messages
--    dedupe_key UNIQUE collapses duplicate enqueues (staff double-confirm,
--    sweeps running twice, bridge retries).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  kind text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  wa_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.wa_touch_outbox()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS wa_outbox_touch ON public.wa_outbox;
CREATE TRIGGER wa_outbox_touch
  BEFORE UPDATE ON public.wa_outbox
  FOR EACH ROW EXECUTE FUNCTION public.wa_touch_outbox();

CREATE INDEX IF NOT EXISTS wa_outbox_claim_idx
  ON public.wa_outbox (status, created_at);

-- ---------------------------------------------------------------------------
-- 5. wa_proofs — manual-payment proof lifecycle (idempotent by WA message id)
--    The file itself lands in the existing private `payment-proofs` storage
--    bucket under bookings/{bookingId}/wa-… and is readable by staff only via
--    the booking's payment_proof_path + the existing signed-URL admin UI.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_group_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'deposit' CHECK (kind IN ('deposit', 'balance')),
  wa_message_id text NOT NULL UNIQUE,
  chat_id text NOT NULL,
  file_path text,
  mime text,
  bytes integer,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'stored', 'rejected', 'failed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_proofs_group_idx ON public.wa_proofs (booking_group_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. wa_nonces — machine-auth replay protection (short-lived)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_nonces (
  key_id text NOT NULL,
  nonce text NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_id, nonce)
);

-- ---------------------------------------------------------------------------
-- 6b. wa_settings — owner-approved payment instructions, set by staff in the
--     admin (never hardcoded in the bridge/Git). QR image bytes are stored
--     as base64 in the private payment-proofs bucket path given by
--     `qr_storage_path`; the bridge fetches it via a signed read URL.
--     ponytail: single-row settings table; a full key/value settings system
--     can replace it when more settings arrive.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  payment_text_en text NOT NULL DEFAULT '',
  payment_text_bm text NOT NULL DEFAULT '',
  qr_storage_path text,
  hold_minutes integer NOT NULL DEFAULT 30 CHECK (hold_minutes BETWEEN 5 AND 240),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_settings TO service_role;
-- Owner/staff may read the payment settings they configured (not the QR
-- secret bucket path — that stays service_role only through the column grant
-- trick below is unnecessary since the path itself is not a secret; the
-- bucket is private and signed URLs are minted server-side).
DROP POLICY IF EXISTS "Admins manage wa settings" ON public.wa_settings;
CREATE POLICY "Admins manage wa settings" ON public.wa_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 6c. wa_events lifecycle: unprocessed events older than the reclaim window
--     are re-claimable so a crashed bridge does not strand the message.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS wa_events_reclaim_idx
  ON public.wa_events (received_at)
  WHERE processed_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS: deny everything to anon/authenticated; service_role only.
-- (wa_proofs additionally readable by admins for audit from the admin UI.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_nonces ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_outbox TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_proofs TO service_role;
GRANT SELECT, INSERT, DELETE ON public.wa_nonces TO service_role;

DROP POLICY IF EXISTS "Admins read wa proofs" ON public.wa_proofs;
CREATE POLICY "Admins read wa proofs" ON public.wa_proofs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- RPC: claims a booking hold atomically.
--
-- Locks the cabin row FOR UPDATE first, so two concurrent claims for the same
-- cabin serialize: the loser re-checks cabin_taken_dates after the winner's
-- insert commits and sees the live hold. This closes the pre-existing
-- scan→insert race for the WA path without touching the web path.
--
-- Price discipline: the caller (app prepare endpoint) computes pricing with
-- the same TS engine as the web flow (compute_booking_price + pickBestDiscount)
-- and passes it in; the RPC recomputes the base price and rejects mismatches,
-- so a stale quote can never materialize into a wrongly-priced row.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.booking_ref_seq START 10000;

CREATE OR REPLACE FUNCTION public.wa_claim_hold(
  _cabin_id uuid,
  _check_in date,
  _check_out date,
  _comforter boolean,
  _guests integer,
  _guest_name text,
  _phone text,
  _chat_id text,
  _subtotal numeric,
  _comforter_total numeric,
  _discount_id uuid DEFAULT NULL,
  _discount_code text DEFAULT NULL,
  _discount_amount numeric DEFAULT 0
) RETURNS TABLE (
  booking_id uuid,
  booking_group_id uuid,
  guest_token uuid,
  payment_reference text,
  nights integer,
  subtotal numeric,
  comforter_total numeric,
  total_amount numeric,
  deposit_amount numeric,
  balance_amount numeric,
  hold_expires_at timestamptz,
  created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.cabins%ROWTYPE;
  p RECORD;
  gid uuid := gen_random_uuid();
  gtoken uuid := gen_random_uuid();
  hold_until timestamptz := now() + interval '30 minutes';
  _already boolean;
  _disc numeric := round(COALESCE(_discount_amount, 0), 2);
  row public.booking_requests%ROWTYPE;
  _constraint text;
BEGIN
  IF _check_out <= _check_in THEN
    RETURN; -- empty result set: caller reports invalid input
  END IF;

  -- A live WA draft for this chat already exists (unique index backstop).
  SELECT EXISTS (
    SELECT 1 FROM public.booking_requests
    WHERE source = 'wa' AND wa_chat_id = _chat_id
      AND status IN ('pending_payment', 'awaiting_review')
  ) INTO _already;
  IF _already THEN
    RETURN;
  END IF;

  -- Serialize claims against this cabin.
  SELECT * INTO c FROM public.cabins WHERE id = _cabin_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WA_HOLD_CABIN_NOT_FOUND';
  END IF;

  -- Re-check availability while holding the cabin lock.
  IF EXISTS (SELECT 1 FROM public.cabin_taken_dates(_cabin_id, _check_in, _check_out - 1)) THEN
    RETURN; -- sold out between prepare and claim
  END IF;

  SELECT * INTO p FROM public.compute_booking_price(_cabin_id, _check_in, _check_out, _comforter);
  IF round(p.subtotal::numeric, 2) <> round(_subtotal, 2)
     OR round(p.comforter_total::numeric, 2) <> round(_comforter_total, 2) THEN
    RAISE EXCEPTION 'WA_HOLD_PRICE_MISMATCH';
  END IF;

  FOR attempt IN 1..5 LOOP
    BEGIN
      INSERT INTO public.booking_requests (
        guest_name, email, phone, check_in, check_out, guests,
        cabin_id, room_type, nights, subtotal,
        comforter, comforter_total, total_amount,
        deposit_amount, balance_amount,
        payment_reference, payment_type,
        source, wa_chat_id, status, hold_expires_at,
        booking_group_id, guest_token,
        discount_id, discount_code, discount_amount
      ) VALUES (
        left(trim(_guest_name), 100), 'wa+' || _chat_id || '@admin.local', left(trim(_phone), 30),
        _check_in, _check_out, _guests,
        _cabin_id, c.name, p.nights, p.subtotal,
        _comforter, p.comforter_total,
        p.subtotal + p.comforter_total - _disc,
        50, p.subtotal + p.comforter_total - _disc,
        'RJW-' || nextval('public.booking_ref_seq'), 'deposit',
        'wa', _chat_id, 'pending_payment', hold_until,
        gid, gtoken,
        _discount_id, _discount_code, _disc
      )
      RETURNING * INTO row;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS _constraint = CONSTRAINT_NAME;
      IF _constraint = 'booking_requests_wa_chat_live_idx' THEN
        RETURN; -- a concurrent claim for this chat won the race
      END IF;
      -- anything else (e.g. legacy payment_reference collision): retry the loop
    END;
  END LOOP;

  IF row.id IS NULL THEN
    RAISE EXCEPTION 'WA_HOLD_INSERT_FAILED';
  END IF;

  RETURN QUERY SELECT
    row.id, row.booking_group_id, row.guest_token, row.payment_reference,
    p.nights, p.subtotal, p.comforter_total,
    p.subtotal + p.comforter_total - _disc,
    50::numeric, p.subtotal + p.comforter_total - _disc,
    row.hold_expires_at, row.created_at;
END $$;

REVOKE ALL ON FUNCTION public.wa_claim_hold(uuid,date,date,boolean,integer,text,text,text,numeric,numeric,uuid,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wa_claim_hold(uuid,date,date,boolean,integer,text,text,text,numeric,numeric,uuid,text,numeric) TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: expire stale WA holds (idempotent: status guard). Returns the affected
-- chats so the bridge can enqueue a polite notice. Availability was already
-- lazily freed by cabin_taken_dates once hold_expires_at passed; this flags
-- the rows so staff dashboards show them as expired.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_expire_stale_holds()
RETURNS TABLE (chat_id text, booking_group_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.booking_requests b
    SET status = 'expired'
  WHERE b.source = 'wa'
    AND b.status = 'pending_payment'
    AND b.hold_expires_at IS NOT NULL
    AND b.hold_expires_at <= now()
  RETURNING b.wa_chat_id, b.booking_group_id;
END $$;

REVOKE ALL ON FUNCTION public.wa_expire_stale_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wa_expire_stale_holds() TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: claim the next outbox batch for sending. Marks rows 'sending' and
-- bumps attempts; reclaims sending rows stuck > 5 min (bridge crash/restart);
-- fails rows that exhausted the retry budget. SKIP LOCKED lets two bridge
-- replicas poll without stealing each other's rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_outbox_claim(_batch integer DEFAULT 10)
RETURNS TABLE (id uuid, chat_id text, kind text, payload jsonb, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.wa_outbox o
    SET status = 'failed', last_error = 'max attempts reached'
  WHERE o.status = 'sending' AND o.attempts >= 3;

  RETURN QUERY
  UPDATE public.wa_outbox o
    SET status = 'sending', attempts = o.attempts + 1
  WHERE o.id IN (
    SELECT o2.id FROM public.wa_outbox o2
    WHERE o2.status = 'pending'
       OR (o2.status = 'sending' AND o2.updated_at < now() - interval '5 minutes')
    ORDER BY o2.created_at
    LIMIT _batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING o.id, o.chat_id, o.kind, o.payload, o.attempts;
END $$;

REVOKE ALL ON FUNCTION public.wa_outbox_claim(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wa_outbox_claim(integer) TO service_role;

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