# Database migrations

The schema for the `anon-india-crm` Supabase project (`dfjyslxrzniqtlniseat`).

Until now these lived only inside the hosted project — the repo had no record of
them, so the database could not be rebuilt, branched, or reviewed from source.
The files here were recovered from the project's own `supabase_migrations.schema_migrations`
table and verified byte-for-byte (MD5) against the live rows, so filename order
and contents match what has actually been applied.

## Applying changes

Migrations are applied to the hosted project in timestamp order. `supabase db push`
applies anything not yet recorded in `schema_migrations`; every file listed there
is already applied and will be skipped.

```bash
supabase link --project-ref dfjyslxrzniqtlniseat   # once, per machine
supabase db push
```

## Adding a migration

```bash
supabase migration new short_description_here
```

Write the SQL into the generated file and push. Two rules this schema has been
bitten by:

- **`SECURITY DEFINER` functions must set a search path.** `handle_new_user()`
  shipped without one and referenced `profiles` unqualified; GoTrue's connection
  has no `public` on its `search_path`, so every new-user creation failed with
  "Database error creating new user" until `20260809154038` fixed it. Always
  write `set search_path = public, pg_temp` and schema-qualify table names.
- **Deleting a user is not a small operation.** 60+ foreign keys point at
  `profiles` / `auth.users`, and the ones on business tables (`leads`,
  `bookings`, `projects`, `lead_activities`) are `NO ACTION` — a delete fails
  until those rows are re-pointed or nulled.

## Caveat

These files reproduce the recorded migration history, not necessarily the full
live schema. Anything applied outside the migration system — dashboard edits,
ad-hoc SQL — is not captured here. If you suspect drift, diff against the
project with `supabase db diff --linked` before relying on a rebuild.
