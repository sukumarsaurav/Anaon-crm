-- Wrap auth.uid() in a scalar subquery so Postgres evaluates it once per query
-- instead of once per row (auth_rls_initplan).
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select using (user_id = (select auth.uid()));

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
  for insert with check (user_id = (select auth.uid()));

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete using (user_id = (select auth.uid()));