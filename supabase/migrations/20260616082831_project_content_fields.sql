alter table public.projects
  add column if not exists developer_about text,
  add column if not exists usp text[] not null default '{}',
  add column if not exists connectivity jsonb not null default '[]'::jsonb,
  add column if not exists faqs jsonb not null default '[]'::jsonb;

comment on column public.projects.developer_about is 'About-the-developer copy shown on the project detail page.';
comment on column public.projects.usp is 'Why-Invest highlight bullets (plain strings).';
comment on column public.projects.connectivity is 'Location advantages: [{ place, distance }].';
comment on column public.projects.faqs is 'Curated FAQs: [{ q, a }]. Overrides auto-generated FAQs when present.';