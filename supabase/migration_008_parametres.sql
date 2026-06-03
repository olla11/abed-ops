-- Migration 008 : table parametres (taux horaire configurable par la CAF)
create table if not exists public.parametres (
  cle   text primary key,
  valeur text not null,
  updated_at timestamptz not null default now()
);

-- Valeur par défaut
insert into public.parametres (cle, valeur)
  values ('taux_horaire_fcfa', '1500')
  on conflict (cle) do nothing;

-- RLS
alter table public.parametres enable row level security;

create policy "lecture publique parametres"
  on public.parametres for select using (true);

create policy "caf et admin modifient parametres"
  on public.parametres for update using (
    public.current_role() in ('caf', 'admin')
  );
