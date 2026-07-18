
-- Helper: is the current auth user an active admin recipient?
CREATE OR REPLACE FUNCTION public.is_admin_email(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_email_recipients r
    JOIN auth.users u ON lower(u.email) = lower(r.email)
    WHERE u.id = _uid AND r.is_active = true
  )
$$;

-- crm_guests
CREATE TABLE public.crm_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  full_name text,
  total_bookings integer NOT NULL DEFAULT 0,
  total_nights integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_stay_at date,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  marketing_opt_in boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_guests_email_lower_unique UNIQUE (email)
);
CREATE INDEX crm_guests_last_stay_idx ON public.crm_guests (last_stay_at DESC NULLS LAST);
CREATE INDEX crm_guests_tags_idx ON public.crm_guests USING GIN (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_guests TO authenticated;
GRANT ALL ON public.crm_guests TO service_role;
ALTER TABLE public.crm_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage crm_guests" ON public.crm_guests
  FOR ALL TO authenticated
  USING (public.is_admin_email(auth.uid()))
  WITH CHECK (public.is_admin_email(auth.uid()));

CREATE TRIGGER crm_guests_set_updated_at
  BEFORE UPDATE ON public.crm_guests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- crm_tasks
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.crm_guests(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_tasks_guest_idx ON public.crm_tasks (guest_id);
CREATE INDEX crm_tasks_open_idx ON public.crm_tasks (done, due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage crm_tasks" ON public.crm_tasks
  FOR ALL TO authenticated
  USING (public.is_admin_email(auth.uid()))
  WITH CHECK (public.is_admin_email(auth.uid()));

-- crm_broadcasts
CREATE TABLE public.crm_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body_html text NOT NULL,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid
);
CREATE INDEX crm_broadcasts_sent_idx ON public.crm_broadcasts (sent_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_broadcasts TO authenticated;
GRANT ALL ON public.crm_broadcasts TO service_role;
ALTER TABLE public.crm_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage crm_broadcasts" ON public.crm_broadcasts
  FOR ALL TO authenticated
  USING (public.is_admin_email(auth.uid()))
  WITH CHECK (public.is_admin_email(auth.uid()));
