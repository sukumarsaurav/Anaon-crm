-- resolve_marketing_campaign is SECURITY DEFINER and was callable over /rpc by any signed-in
-- user (brokers, portal clients). Only the lead trigger needs it: run that trigger as definer
-- and take the function off the API.
alter function public.leads_link_marketing_campaign() security definer;
revoke all on function public.leads_link_marketing_campaign() from public, anon, authenticated;
revoke all on function public.resolve_marketing_campaign(text, text, text) from public, anon, authenticated;
