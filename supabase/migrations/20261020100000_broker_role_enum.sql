-- The broker portal gates on profiles.role = 'broker', but that value never existed in the
-- enum, so no broker could ever sign in. Added alone: a new enum value can't be used in the
-- transaction that adds it.
alter type public.user_role add value if not exists 'broker';
