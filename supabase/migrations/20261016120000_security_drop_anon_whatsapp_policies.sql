-- The anon role (the public key shipped to every browser) could read, rewrite and
-- delete every WhatsApp conversation, and insert/update any message, through
-- /rest/v1. These "service" policies existed because the Meta webhook wrote with the
-- cookie client (anon, no session). Both webhooks now use the service-role client,
-- which bypasses RLS, so anon needs no access at all.
drop policy if exists "wa_conversations_service_write" on public.whatsapp_conversations;
drop policy if exists "wa_messages_service_insert"     on public.whatsapp_messages;
drop policy if exists "wa_messages_service_update"     on public.whatsapp_messages;
