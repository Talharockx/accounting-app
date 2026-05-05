-- Add this column once so the app can use `transactions.metadata` (recommended).
-- Until you run it, the app still saves by embedding JSON at the end of `description`.
--
-- Supabase Dashboard → SQL → New query → paste → Run.
-- Or: supabase/migrations/20260506120000_add_transactions_metadata.sql with Supabase CLI.
alter table public.transactions add column if not exists metadata jsonb not null default '{}'::jsonb;
