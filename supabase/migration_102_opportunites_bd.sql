-- Migration 102 : registre des opportunités de financement (Business Developer)
-- Menu /bd — reprend la structure du registre Excel existant (identification,
-- suivi jusqu'à la réponse du bailleur), avec un statut unifié (au lieu des
-- deux colonnes séparées Statut/Réponse du registre) + montants demandé/obtenu.

create type opportunite_bd_statut as enum (
  'identifie', 'en_preparation', 'soumis', 'accepte', 'refuse', 'sans_reponse', 'abandonne'
);

create table public.opportunites_bd (
  id                        uuid primary key default gen_random_uuid(),
  titre                     text not null,
  bailleur                  text,
  description_appel         text,
  personnes_associees       text,
  identifie_par             uuid not null references public.profiles(id),
  date_identification       date not null default current_date,
  date_publication          date,
  date_limite               date,
  date_soumission           date,
  description_proposition   text,
  commentaires              text,
  observations              text,
  statut                    opportunite_bd_statut not null default 'identifie',
  montant_demande           numeric(14,2),
  montant_obtenu            numeric(14,2),
  pieces_jointes            jsonb not null default '[]'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index idx_opportunites_bd_statut on public.opportunites_bd(statut);
create index idx_opportunites_bd_date_limite on public.opportunites_bd(date_limite);
create index idx_opportunites_bd_date_identification on public.opportunites_bd(date_identification);

alter table public.opportunites_bd enable row level security;

-- Lecture : équipe Business Developer (tout le pipeline, registre partagé
-- comme dans le fichier Excel actuel — pas cloisonné par personne) + DE en
-- supervision (lecture seule, appliqué côté application) + admin/superadmin.
create policy "opportunites_bd_select" on public.opportunites_bd
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and (titre = 'business_developer' or role in ('de', 'admin', 'superadmin'))
    )
  );

-- Écriture (créer/modifier/supprimer) : équipe BD + admin/superadmin
-- uniquement — le DE reste en lecture seule (appliqué aussi côté UI/API).
create policy "opportunites_bd_insert" on public.opportunites_bd
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and (titre = 'business_developer' or role in ('admin', 'superadmin'))
    )
  );

create policy "opportunites_bd_update" on public.opportunites_bd
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and (titre = 'business_developer' or role in ('admin', 'superadmin'))
    )
  );

create policy "opportunites_bd_delete" on public.opportunites_bd
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and (titre = 'business_developer' or role in ('admin', 'superadmin'))
    )
  );
