-- Allow "grocery" as a valid business_type for LedgerView provisioning.
-- Apply in Supabase Dashboard → SQL Editor, or via: supabase db push

alter table public.businesses
  drop constraint if exists businesses_business_type_check;

alter table public.businesses
  add constraint businesses_business_type_check
  check (business_type in ('restaurant', 'mobile_shop', 'grocery'));
