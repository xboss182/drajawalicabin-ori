REVOKE ALL ON FUNCTION public.wa_claim_hold(uuid,date,date,boolean,integer,text,text,text,numeric,numeric,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_expire_stale_holds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_outbox_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_claim_hold(uuid,date,date,boolean,integer,text,text,text,numeric,numeric,uuid,text,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.wa_expire_stale_holds() TO service_role;
GRANT EXECUTE ON FUNCTION public.wa_outbox_claim(integer) TO service_role;

ALTER FUNCTION public.wa_touch_conversation() SET search_path = public;
ALTER FUNCTION public.wa_touch_outbox() SET search_path = public;