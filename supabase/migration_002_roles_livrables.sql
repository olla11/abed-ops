-- =====================================================================
-- ABED-ONG — Migration 002
-- Titres du personnel, livrables des prestataires, délais & alertes
-- À exécuter APRÈS schema.sql, dans Supabase SQL Editor
-- =====================================================================

-- ---------- ENUMS supplémentaires ----------
create type type_emploi as enum (
  'benevole','stagiaire_n1','stagiaire_n2',
  'prestataire_direct','prestataire_credit','cdd'
);

create type titre_poste as enum (
  'directeur_executif','directeur_principal','programme_lead','charge_projet',
  'agent_projet','animateur','caf','aaf','assistant_admin','rh',
  'conducteur','agent_entretien'
);

create type livrable_status as enum ('soumis','valide','rejete','corrections');
create type soumission_type as enum ('timesheet','facture','livrable','etat_deplacement','demande_paiement');

-- ---------- PROFILS : on ajoute titre + type d'emploi ----------
alter table public.profiles
  add column titre        titre_poste,
  add column type_emploi  type_emploi;
-- NB : la colonne 'role' (user_role) existante reste le NIVEAU D'ACCÈS.
-- Le titre est attribué par admin/rh/caf ; l'application déduit le role du titre.

-- ---------- SOUMISSIONS DES PRESTATAIRES (timesheets, factures, livrables) ----------
-- Chaque soumission porte un TITRE donné par le prestataire.
create table public.soumissions (
  id              uuid primary key default gen_random_uuid(),
  prestataire_id  uuid not null references public.profiles(id),
  manager_id      uuid not null references public.profiles(id),  -- responsable direct (validation)
  titre           text not null,                                  -- titre libre donné par le prestataire
  type            soumission_type not null,
  periode_mois    int,                                            -- pour timesheets/factures mensuelles
  periode_annee   int,
  fichier_url     text,                                           -- pièce jointe (Storage)
  contenu         jsonb,                                          -- lignes timesheet, détails facture...
  montant         numeric(12,2),                                  -- pour factures / demandes de paiement
  status          livrable_status not null default 'soumis',
  commentaire_validation text,
  valide_par      uuid references public.profiles(id),
  valide_le       timestamptz,
  -- Délais (déduits des procédures)
  date_limite     date,        -- ex: le 5 du mois suivant
  created_at      timestamptz not null default now()
);

create index idx_soumissions_prestataire on public.soumissions(prestataire_id);
create index idx_soumissions_manager on public.soumissions(manager_id);
create index idx_soumissions_status on public.soumissions(status);

-- ---------- JOURNAL DES ALERTES (évite les doublons d'envoi) ----------
create table public.alertes_envoyees (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  type_alerte   text not null,            -- ex: 'timesheet_J-3', 'timesheet_J0', 'rapport_mission_72h'
  reference     text,                     -- ex: '2026-05' ou id de mission
  envoyee_le    timestamptz not null default now(),
  unique (user_id, type_alerte, reference)
);

-- =====================================================================
-- RLS pour les nouvelles tables
-- =====================================================================
alter table public.soumissions      enable row level security;
alter table public.alertes_envoyees enable row level security;

create policy "prestataire et manager voient la soumission"
  on public.soumissions for select using (
    prestataire_id = auth.uid()
    or manager_id = auth.uid()
    or public.current_role() in ('caf','de','admin','rh')
  );
create policy "prestataire soumet"
  on public.soumissions for insert with check (prestataire_id = auth.uid());
create policy "manager valide / prestataire corrige"
  on public.soumissions for update using (
    manager_id = auth.uid()
    or (prestataire_id = auth.uid() and status in ('corrections','rejete'))
    or public.current_role() in ('admin')
  );

create policy "voir ses alertes"
  on public.alertes_envoyees for select using (
    user_id = auth.uid() or public.current_role() in ('admin','rh','caf')
  );

-- =====================================================================
-- Attribution du titre -> NIVEAU D'ACCÈS (role)
-- Seuls admin / rh / caf peuvent attribuer un titre.
-- =====================================================================
create or replace function public.attribuer_titre(
  cible uuid,
  nouveau_titre titre_poste,
  nouveau_type type_emploi default null
) returns void language plpgsql security definer as $$
declare
  demandeur_role user_role;
  access user_role;
begin
  select role into demandeur_role from public.profiles where id = auth.uid();
  if demandeur_role not in ('admin','rh','caf') then
    raise exception 'Non autorisé : seuls Admin, RH et CAF attribuent les titres';
  end if;

  -- déduire le niveau d'accès du titre
  access := case nouveau_titre
    when 'directeur_executif' then 'de'
    when 'caf' then 'caf'
    when 'rh' then 'rh'
    when 'directeur_principal' then 'manager'
    when 'programme_lead' then 'manager'
    when 'charge_projet' then 'manager'
    else 'missionnaire'
  end::user_role;

  update public.profiles
    set titre = nouveau_titre,
        type_emploi = coalesce(nouveau_type, type_emploi),
        role = access
    where id = cible;
end $$;

-- =====================================================================
-- Calcul automatique de la date limite à la soumission
-- (timesheets/factures : le 5 du mois suivant la période)
-- =====================================================================
create or replace function public.set_date_limite()
returns trigger language plpgsql as $$
begin
  if new.type in ('timesheet','facture','demande_paiement','etat_deplacement')
     and new.periode_mois is not null and new.periode_annee is not null then
    -- le 5 du mois suivant la période déclarée
    new.date_limite := (make_date(new.periode_annee, new.periode_mois, 1)
                         + interval '1 month' + interval '4 days')::date;
  end if;
  return new;
end $$;

create trigger trg_set_date_limite
  before insert on public.soumissions
  for each row execute function public.set_date_limite();
