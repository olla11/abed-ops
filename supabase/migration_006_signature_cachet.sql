-- Migration 006 : colonnes signature_url et cachet_url sur profiles
alter table public.profiles
  add column if not exists signature_url text,
  add column if not exists cachet_url text;

-- Bucket Storage pour les assets (signatures, cachets)
-- À créer manuellement dans le dashboard Supabase Storage ou via API
-- insert into storage.buckets (id, name, public) values ('assets', 'assets', false) on conflict do nothing;

-- RLS Storage : seul le propriétaire ou un admin peut voir/écrire ses assets
-- create policy "owner or admin read assets"
--   on storage.objects for select using (
--     auth.uid()::text = (storage.foldername(name))[1]
--     or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
--   );
-- create policy "owner upload assets"
--   on storage.objects for insert with check (
--     auth.uid()::text = (storage.foldername(name))[1]
--   );
