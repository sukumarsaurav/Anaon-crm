
-- ── Portal: check session & return client JSON ──────────────────────
CREATE OR REPLACE FUNCTION public.portal_check_session(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_client    json;
BEGIN
  SELECT ps.client_id INTO v_client_id
  FROM portal_sessions ps
  WHERE ps.token = p_token
    AND ps.expires_at > now()
  LIMIT 1;

  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT row_to_json(c.*) INTO v_client
  FROM clients c WHERE c.id = v_client_id;

  RETURN v_client;
END;
$$;

-- ── Portal: create OTP (returns 'ok', 'no_client', 'rate_limited') ─
CREATE OR REPLACE FUNCTION public.portal_create_otp(
  p_phone      text,
  p_otp_hash   text,
  p_expires_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists bool;
  v_count  int;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM clients
    WHERE phone = p_phone OR phone = '+91'||p_phone OR phone = '91'||p_phone
  ) INTO v_exists;

  IF NOT v_exists THEN RETURN 'no_client'; END IF;

  SELECT COUNT(*) INTO v_count
  FROM portal_otp_requests
  WHERE phone = p_phone AND created_at > now() - interval '10 minutes';

  IF v_count >= 3 THEN RETURN 'rate_limited'; END IF;

  INSERT INTO portal_otp_requests (phone, otp_hash, expires_at)
  VALUES (p_phone, p_otp_hash, p_expires_at);

  RETURN 'ok';
END;
$$;

-- ── Portal: verify OTP & create session (returns token or error code) ──
CREATE OR REPLACE FUNCTION public.portal_verify_otp(p_phone text, p_otp_hash text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       portal_otp_requests%ROWTYPE;
  v_client_id uuid;
  v_token     text;
BEGIN
  SELECT * INTO v_row
  FROM portal_otp_requests
  WHERE phone = p_phone AND verified = false AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN RETURN 'otp_not_found'; END IF;
  IF v_row.attempts >= 5 THEN RETURN 'too_many_attempts'; END IF;

  UPDATE portal_otp_requests SET attempts = attempts + 1 WHERE id = v_row.id;

  IF v_row.otp_hash != p_otp_hash THEN RETURN 'invalid_otp'; END IF;

  UPDATE portal_otp_requests SET verified = true WHERE id = v_row.id;

  SELECT id INTO v_client_id
  FROM clients
  WHERE phone = p_phone OR phone = '+91'||p_phone OR phone = '91'||p_phone
  LIMIT 1;

  IF v_client_id IS NULL THEN RETURN 'client_not_found'; END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO portal_sessions (client_id, token, expires_at)
  VALUES (v_client_id, v_token, now() + interval '30 days');

  RETURN v_token;
END;
$$;

-- ── Portal: delete session ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_delete_session(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM portal_sessions WHERE token = p_token;
END;
$$;

-- ── Portal: create payment extension request ───────────────────────
CREATE OR REPLACE FUNCTION public.portal_create_extension_request(
  p_client_id     uuid,
  p_payment_id    uuid,
  p_booking_id    uuid,
  p_reason        text,
  p_requested_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO payment_extension_requests
    (client_id, payment_id, booking_id, reason, requested_date)
  VALUES
    (p_client_id, p_payment_id, p_booking_id, p_reason, p_requested_date);
  RETURN true;
END;
$$;

-- ── Portal: create complaint ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_create_complaint(
  p_client_id  uuid,
  p_booking_id uuid,
  p_category   text,
  p_description text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO complaints (client_id, booking_id, category, description, priority, status, photo_urls)
  VALUES (p_client_id, p_booking_id, p_category, p_description, 'normal', 'open', '[]');
  RETURN true;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.portal_check_session(text)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_otp(text, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_verify_otp(text, text)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_delete_session(text)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_extension_request(uuid, uuid, uuid, text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_complaint(uuid, uuid, text, text) TO anon, authenticated;
