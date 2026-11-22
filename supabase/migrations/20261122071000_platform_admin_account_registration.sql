CREATE OR REPLACE FUNCTION public.private_invitation_email(p_kind text, p_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text;
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 IF p_kind = 'school_admin' THEN
   SELECT i.email INTO v_email FROM public.school_admin_invitations i
   WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now();
 ELSIF p_kind = 'platform_admin' THEN
   SELECT i.email INTO v_email FROM public.platform_admin_invitations i
   WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now();
 ELSIF p_kind = 'staff' THEN
   SELECT i.email INTO v_email FROM public.school_staff_invitations i
   WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now();
 END IF;
 RETURN lower(v_email);
END $function$
;