-- One-off script: run this in Supabase Dashboard → SQL Editor
-- (Project → SQL → New query → paste → Run)

alter table public.businesses
  drop constraint if exists businesses_business_type_check;

alter table public.businesses
  add constraint businesses_business_type_check
  check (business_type in ('restaurant', 'mobile_shop', 'grocery'));
