-- Contact / registration fields for each business workspace.
-- Apply in Supabase SQL Editor or via: supabase db push
alter table public.businesses
  add column if not exists phone_number text not null default '',
  add column if not exists vat_number text not null default '',
  add column if not exists address text not null default '',
  add column if not exists contact_email text not null default '';
