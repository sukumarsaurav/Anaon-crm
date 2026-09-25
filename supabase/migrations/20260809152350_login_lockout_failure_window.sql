alter table public.profiles
  add column if not exists last_failed_login_at timestamptz;

comment on column public.profiles.last_failed_login_at is
  'Timestamp of the most recent failed login. Failures older than the lockout window are discarded so the counter cannot accumulate indefinitely.';