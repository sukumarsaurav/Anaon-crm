-- Private bucket for staff uploads (KYC documents, project documents, agreements, construction
-- photos, legal templates). No storage policies: uploads use one-time signed URLs issued by the server
-- (lib/files/actions.ts) and reads go through /api/files, which checks access and signs a short URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-files', 'crm-files', false, 26214400,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
