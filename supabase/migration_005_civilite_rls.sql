-- Migration 005 : civilité/sexe sur profiles + RLS missions pour caf/de/admin
-- À exécuter dans Supabase Dashboard > SQL Editor

-- ===== PROFILS : champ civilite =====
alter table public.profiles
  add column if not exists civilite text check (civilite in ('M.', 'Mme', 'Dr', 'Pr')) default 'M.';

-- ===== RLS MISSIONS : caf / de / admin voient TOUTES les missions =====
-- Supprimer l'ancienne policy trop restrictive si elle existe
drop policy if exists "missionnaire voit ses missions" on public.missions;
drop policy if exists "missions_select_own" on public.missions;
drop policy if exists "Missions visibles par le missionnaire" on public.missions;

-- Policy : missionnaire voit les siennes, caf/de/admin voient tout
create policy "missions_select" on public.missions
  for select using (
    auth.uid() = missionnaire_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('caf', 'de', 'admin', 'rh')
    )
  );
