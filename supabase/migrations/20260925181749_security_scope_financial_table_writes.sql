-- The previous migration scoped SELECT, but each of these tables still carried
-- trivially-permissive write policies that ALSO leak SELECT:
--   team_write_*            [ALL]    USING (auth.uid() IN all-active)
--   *_update_authenticated  [UPDATE] USING (true)
--   *_insert_authenticated  [INSERT] WITH CHECK (true)
-- i.e. every signed-in user could read, update and delete every booking,
-- payment, client and commission. Replace them with a single scoped ALL policy
-- (USING + WITH CHECK) per core table, mirroring the read scope through
-- current_user_visible_members(): admin sees/writes all, team leaders their
-- subtree, everyone else only records they own. All writes go through the user
-- client, and every insert sets its owner column to the caller, so legitimate
-- creates pass WITH CHECK.

-- bookings
drop policy if exists "team_write_bookings"          on public.bookings;
drop policy if exists "bookings_insert_authenticated" on public.bookings;
drop policy if exists "bookings_update_authenticated" on public.bookings;
drop policy if exists "bookings_read_scoped"          on public.bookings;
create policy "bookings_access_scoped" on public.bookings
  for all to authenticated
  using (
    advisor_id  in (select public.current_user_visible_members())
    or manager_id in (select public.current_user_visible_members())
    or created_by in (select public.current_user_visible_members())
  )
  with check (
    advisor_id  in (select public.current_user_visible_members())
    or manager_id in (select public.current_user_visible_members())
    or created_by in (select public.current_user_visible_members())
  );

-- clients
drop policy if exists "team_write_clients"           on public.clients;
drop policy if exists "clients_insert_authenticated" on public.clients;
drop policy if exists "clients_update_authenticated" on public.clients;
drop policy if exists "clients_read_scoped"          on public.clients;
create policy "clients_access_scoped" on public.clients
  for all to authenticated
  using (
    created_by in (select public.current_user_visible_members())
    or id in (
      select b.client_id from public.bookings b
      where b.advisor_id in (select public.current_user_visible_members())
         or b.manager_id in (select public.current_user_visible_members())
         or b.created_by in (select public.current_user_visible_members())
    )
  )
  with check (created_by in (select public.current_user_visible_members()));

-- payments (scoped through the parent booking)
drop policy if exists "team_write_payments"           on public.payments;
drop policy if exists "payments_insert_authenticated" on public.payments;
drop policy if exists "payments_update_authenticated" on public.payments;
drop policy if exists "payments_read_scoped"          on public.payments;
create policy "payments_access_scoped" on public.payments
  for all to authenticated
  using (
    booking_id in (
      select b.id from public.bookings b
      where b.advisor_id in (select public.current_user_visible_members())
         or b.manager_id in (select public.current_user_visible_members())
         or b.created_by in (select public.current_user_visible_members())
    )
  )
  with check (
    booking_id in (
      select b.id from public.bookings b
      where b.advisor_id in (select public.current_user_visible_members())
         or b.manager_id in (select public.current_user_visible_members())
         or b.created_by in (select public.current_user_visible_members())
    )
  );

-- client_documents (uploader, or through the owning client)
drop policy if exists "team_write_client_docs"                on public.client_documents;
drop policy if exists "client_documents_insert_authenticated" on public.client_documents;
drop policy if exists "client_documents_read_scoped"          on public.client_documents;
create policy "client_documents_access_scoped" on public.client_documents
  for all to authenticated
  using (
    uploaded_by in (select public.current_user_visible_members())
    or client_id in (
      select c.id from public.clients c
      where c.created_by in (select public.current_user_visible_members())
    )
  )
  with check (uploaded_by in (select public.current_user_visible_members()));

-- brokers: close the trivial write policies; admin/manager retain full write via
-- brokers_admin_all, creation stays open (brokers_insert_authenticated), reads
-- stay scoped (brokers_read_scoped) + self.
drop policy if exists "team_write_brokers"           on public.brokers;
drop policy if exists "brokers_update_authenticated" on public.brokers;

-- broker_commissions: same shape — admin/manager write via admin_all, creation
-- via insert policy, reads scoped + broker-own.
drop policy if exists "team_write_commissions"                  on public.broker_commissions;
drop policy if exists "broker_commissions_update_authenticated" on public.broker_commissions;
