-- Wrap auth.uid()/auth.jwt()/auth.role()/auth.email() in (select ...) so Postgres
-- evaluates them ONCE per query (initplan) instead of once per row.
-- Uses ALTER POLICY so command + roles are preserved exactly; only the
-- USING / WITH CHECK expressions change. Idempotent: already-wrapped policies
-- are skipped by the cursor filter.
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual       ~ 'auth\.(uid|jwt|role|email)\(\)' AND qual       !~ 'select auth\.')
        OR (with_check ~ 'auth\.(uid|jwt|role|email)\(\)' AND with_check !~ 'select auth\.')
      )
  LOOP
    new_qual  := r.qual;
    new_check := r.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, 'auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, 'auth\.(uid|jwt|role|email)\(\)', '(select auth.\1())', 'g');
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || ' USING (' || new_qual || ')';
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE stmt;
    RAISE NOTICE 'Rewrote policy % on %.%', r.policyname, r.schemaname, r.tablename;
  END LOOP;
END $$;