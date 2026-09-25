-- Restrict every `public`-role policy to `authenticated`, EXCEPT the handful of
-- genuine anonymous reads used by the public marketing site / careers form.
-- This removes the anon-side "multiple permissive policies" duplication (perf)
-- and closes accidental anon read/write on staff/service tables (security).
-- ALTER POLICY ... TO preserves the command, USING and WITH CHECK unchanged.
DO $$
DECLARE
  r record;
  whitelist text[][] := ARRAY[
    ['blog_posts','public read published blogs'],
    ['career_listings','public read active careers'],
    ['career_applications','public insert applications'],
    ['testimonials','public read active testimonials'],
    ['branches','branches_read_all'],
    ['developers','developers_public_read'],
    ['team_members','team_members_public_read']
  ];
  is_public_intended boolean;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname='public' AND roles = '{public}'
  LOOP
    is_public_intended := EXISTS (
      SELECT 1 FROM generate_subscripts(whitelist, 1) i
      WHERE whitelist[i][1] = r.tablename AND whitelist[i][2] = r.policyname
    );
    IF NOT is_public_intended THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
      RAISE NOTICE 'Restricted % on % to authenticated', r.policyname, r.tablename;
    END IF;
  END LOOP;
END $$;