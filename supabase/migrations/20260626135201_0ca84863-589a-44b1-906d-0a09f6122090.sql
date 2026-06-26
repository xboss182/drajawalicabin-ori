CREATE TABLE public.manage_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.manage_link_requests TO service_role;
ALTER TABLE public.manage_link_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX manage_link_requests_ip_time_idx ON public.manage_link_requests (ip, requested_at DESC);