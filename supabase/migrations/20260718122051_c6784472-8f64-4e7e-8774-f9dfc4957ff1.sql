
REVOKE EXECUTE ON FUNCTION public.is_admin_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_email(uuid) TO authenticated, service_role;
