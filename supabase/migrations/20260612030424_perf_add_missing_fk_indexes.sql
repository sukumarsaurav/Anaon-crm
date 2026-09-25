-- Adds a covering index for every foreign key in `public` that lacks one.
-- Idempotent: re-running creates nothing once all FKs are covered.
DO $$
DECLARE
  r record;
  idx_name text;
BEGIN
  FOR r IN
    SELECT
      c.conrelid::regclass AS tbl,
      c.conkey,
      (SELECT string_agg(a.attname, '_' ORDER BY x.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum) AS colnames,
      (SELECT string_agg(quote_ident(a.attname), ',' ORDER BY x.ord)
         FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum) AS collist
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
      )
  LOOP
    idx_name := left('idx_' || replace(r.tbl::text, 'public.', '') || '_' || r.colnames, 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', idx_name, r.tbl, r.collist);
  END LOOP;
END $$;