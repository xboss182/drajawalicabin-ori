REVOKE ALL ON public.manage_link_requests FROM anon, authenticated;
GRANT ALL ON public.manage_link_requests TO service_role;
ALTER TABLE public.manage_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manage_link_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client access to manage_link_requests" ON public.manage_link_requests;
CREATE POLICY "No direct client access to manage_link_requests"
ON public.manage_link_requests
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);