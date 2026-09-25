alter table public.lead_activities
  add column if not exists call_sid text,
  add column if not exists recording_url text;

create index if not exists lead_activities_call_sid_idx on public.lead_activities(call_sid);