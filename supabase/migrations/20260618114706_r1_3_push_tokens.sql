-- Push notification tokens (Expo mobile + Web Push browser subscriptions)
create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    text not null check (platform in ('expo','web')),
  expo_token      text,
  web_subscription jsonb,
  endpoint    text not null,           -- dedupe key: expo token, or web push endpoint
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Users manage only their own tokens; the service role (fan-out) bypasses RLS.
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select using (user_id = auth.uid());

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete using (user_id = auth.uid());