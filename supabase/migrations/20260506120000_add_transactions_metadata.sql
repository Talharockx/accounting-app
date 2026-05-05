-- App daily entry stores structured JSON on transactions.metadata.
-- Run via Supabase SQL Editor, or: supabase db push (if using Supabase CLI locally).
alter table public.transactions add column if not exists metadata jsonb not null default '{}'::jsonb;
