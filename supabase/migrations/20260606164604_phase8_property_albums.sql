CREATE TABLE IF NOT EXISTS property_albums (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  share_token text NOT NULL UNIQUE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  plot_ids uuid[],                              -- curated plots; empty/null = all available
  client_name text,                             -- personalization on the public page
  message text,                                 -- optional intro note from the rep
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS album_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id uuid NOT NULL REFERENCES property_albums(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  user_agent text,
  referrer text
);

CREATE INDEX IF NOT EXISTS idx_album_views_album ON album_views(album_id);
CREATE INDEX IF NOT EXISTS idx_property_albums_created_by ON property_albums(created_by);

ALTER TABLE property_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_albums_read_authenticated ON property_albums FOR SELECT USING (true);
CREATE POLICY property_albums_write_authenticated ON property_albums FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY album_views_read_authenticated ON album_views FOR SELECT USING (true);

-- Atomic view counter, callable from the public share page (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION record_album_view(p_token text, p_ua text, p_ref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM property_albums WHERE share_token = p_token AND is_active;
  IF v_id IS NULL THEN RETURN; END IF;
  UPDATE property_albums SET view_count = view_count + 1, last_viewed_at = now() WHERE id = v_id;
  INSERT INTO album_views (album_id, user_agent, referrer) VALUES (v_id, p_ua, p_ref);
END $$;