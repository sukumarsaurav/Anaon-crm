-- Client portal login matched `phone = '9810001025' OR '+91…' OR '91…'`, but clients are stored
-- as typed ("+91-9810001025"), so no formatted client could ever sign in. Match on the last
-- 10 digits instead (the same rule lead de-duplication uses). EXECUTE grants are unchanged.
create or replace function public.portal_create_otp(p_phone text, p_otp_hash text, p_expires_at timestamp with time zone)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_exists bool;
  v_count  int;
  v_tail   text := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
begin
  if length(v_tail) < 10 then return 'no_client'; end if;

  select exists(
    select 1 from clients
    where right(regexp_replace(phone, '\D', '', 'g'), 10) = v_tail
       or right(regexp_replace(coalesce(alternate_phone, ''), '\D', '', 'g'), 10) = v_tail
  ) into v_exists;

  if not v_exists then return 'no_client'; end if;

  select count(*) into v_count
  from portal_otp_requests
  where phone = v_tail and created_at > now() - interval '10 minutes';

  if v_count >= 3 then return 'rate_limited'; end if;

  insert into portal_otp_requests (phone, otp_hash, expires_at)
  values (v_tail, p_otp_hash, p_expires_at);

  return 'ok';
end;
$function$;

create or replace function public.portal_verify_otp(p_phone text, p_otp_hash text)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_row       portal_otp_requests%rowtype;
  v_client_id uuid;
  v_token     text;
  v_tail      text := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
begin
  select * into v_row
  from portal_otp_requests
  where phone = v_tail and verified = false and expires_at > now()
  order by created_at desc limit 1;

  if not found then return 'otp_not_found'; end if;
  if v_row.attempts >= 5 then return 'too_many_attempts'; end if;

  update portal_otp_requests set attempts = attempts + 1 where id = v_row.id;

  if v_row.otp_hash != p_otp_hash then return 'invalid_otp'; end if;

  update portal_otp_requests set verified = true where id = v_row.id;

  select id into v_client_id
  from clients
  where right(regexp_replace(phone, '\D', '', 'g'), 10) = v_tail
     or right(regexp_replace(coalesce(alternate_phone, ''), '\D', '', 'g'), 10) = v_tail
  order by created_at
  limit 1;

  if v_client_id is null then return 'client_not_found'; end if;

  -- pgcrypto lives in the `extensions` schema; with search_path = public the bare call failed,
  -- so verifying an OTP could never create a session (since the search_path hardening).
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into portal_sessions (client_id, token, expires_at)
  values (v_client_id, v_token, now() + interval '30 days');

  return v_token;
end;
$function$;
