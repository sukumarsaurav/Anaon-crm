-- WhatsApp attachments, copied out of AgencyX's signed links (they expire after 7 days).
-- Private, and no storage.objects policies: only the service role reads or writes it.
-- The inbox hands the browser short-lived signed URLs after its own RLS-checked read
-- of the message (lib/whatsapp/queries.ts).
insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-media', 'whatsapp-media', false, 104857600)
on conflict (id) do nothing;
