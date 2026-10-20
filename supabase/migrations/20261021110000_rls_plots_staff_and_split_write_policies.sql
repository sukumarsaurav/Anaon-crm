-- UI/UX + performance audit (2026-10-20), DB advisors. Approved by the owner 2026-10-20.
--
-- 1. plots_hold let ANY authenticated user update ANY column of ANY plot (`auth.uid() IS NOT NULL`).
--    Broker logins are authenticated too, so a channel partner could change prices or status through
--    the API. Plot writes in the app all come from staff server actions, and release_expired_holds()
--    runs from pg_cron (bypasses RLS), so updates are now limited to active staff.
-- 2. attendance had a "service role" policy attached to `authenticated` that can never be true for
--    an authenticated JWT (the service role bypasses RLS anyway). It only added work to every query.
-- 3. Read + write(ALL) pairs made every SELECT evaluate two policies. Each ALL policy is split into
--    INSERT/UPDATE/DELETE with the same condition, so reads evaluate only the read policy and who
--    can write is unchanged.

-- 1 + 3: plots
drop policy if exists plots_hold on public.plots;
drop policy if exists plots_write on public.plots;
create policy plots_insert on public.plots for insert to authenticated
  with check ((select public.current_user_is_admin_or_manager()));
create policy plots_update on public.plots for update to authenticated
  using ((select public.current_user_is_staff()))
  with check ((select public.current_user_is_staff()));
create policy plots_delete on public.plots for delete to authenticated
  using ((select public.current_user_is_admin_or_manager()));

-- 2: attendance
drop policy if exists "Service role full access on attendance" on public.attendance;

-- 3: admin/manager-written reference tables
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('bank_tieups',              'bank_tieups_write',     'bank_tieups'),
      ('dsas',                     'dsas_write',            'dsas'),
      ('legal_document_templates', 'legal_templates_write', 'legal_templates'),
      ('premium_matrix',           'premium_matrix_write',  'premium_matrix'),
      ('price_escalations',        'price_esc_write',       'price_esc'),
      ('project_documents',        'project_docs_write',    'project_docs'),
      ('projects',                 'projects_write',        'projects')
    ) as v(tbl, old_policy, prefix)
  loop
    execute format('drop policy if exists %I on public.%I', t.old_policy, t.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.current_user_is_admin_or_manager()))', t.prefix || '_insert', t.tbl);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.current_user_is_admin_or_manager())) with check ((select public.current_user_is_admin_or_manager()))', t.prefix || '_update', t.tbl);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.current_user_is_admin_or_manager()))', t.prefix || '_delete', t.tbl);
  end loop;
end $$;

-- 3: incentive slabs are admin-only
drop policy if exists incentive_slabs_manage on public.incentive_slabs;
create policy incentive_slabs_insert on public.incentive_slabs for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy incentive_slabs_update on public.incentive_slabs for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy incentive_slabs_delete on public.incentive_slabs for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
