-- =====================================================================
-- ABED-ONG — Système de gestion des opérations
-- Schéma de base de données (PostgreSQL / Supabase)
-- =====================================================================
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- =====================================================================

-- ---------- ENUMS ----------
create type user_role as enum ('missionnaire', 'manager', 'caf', 'de', 'admin');
create type om_status as enum (
  'brouillon',      -- créé par le missionnaire, pas encore soumis
  'soumis',         -- en attente de validation CAF/DE
  'signe',          -- signé par CAF ou DE, OM disponible au téléchargement
  'en_mission',     -- période de mission en cours
  'reconciliation', -- mission terminée, réconciliation réclamée (72h)
  'paiement_attente', -- point financier validé, prélèvement 20% en attente
  'cloture',        -- réconciliation + paiement (si applicable) validés
  'rejete'
);
create type timesheet_status as enum ('soumis', 'valide', 'rejete', 'corrections');
create type payment_status as enum ('initie', 'en_attente', 'reussi', 'echoue', 'annule');

-- ---------- PROFILS (étend auth.users de Supabase) ----------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nom             text not null,
  prenoms         text not null,
  email           text not null unique,
  telephone       text,                       -- numéro MTN MoMo pour le prélèvement
  ifu             text,
  fonction        text,
  role            user_role not null default 'missionnaire',
  manager_id      uuid references public.profiles(id), -- responsable direct
  created_at      timestamptz not null default now()
);

-- ---------- ORDRES DE MISSION ----------
create table public.missions (
  id                uuid primary key default gen_random_uuid(),
  reference         text unique,              -- ex: 021-26/ABED/DE/CAF/AAF (généré à la signature)
  missionnaire_id   uuid not null references public.profiles(id),
  objet             text not null,
  lieu              text not null,
  moyen_transport   text,
  date_depart       date not null,
  date_retour       date not null,
  imputation        text,                     -- ex: IYBA-SEED, FEDSAEI...
  -- Financement
  a_charge_partenaire boolean not null default false, -- déclenche le prélèvement 20%
  -- Workflow
  status            om_status not null default 'brouillon',
  signe_par         uuid references public.profiles(id),  -- CAF ou DE
  signe_le          timestamptz,
  om_pdf_url        text,                     -- chemin Storage du PDF signé
  -- Réconciliation
  reconciliation_due_at timestamptz,          -- date_retour + 72h
  rapport           jsonb,                    -- formulaire de rapport (compte rendu)
  point_financier   jsonb,                    -- lignes de dépenses {libelle, qte, pu, montant}
  total_depenses    numeric(12,2),
  montant_recu      numeric(12,2),            -- frais reçus du partenaire
  prelevement_20    numeric(12,2),            -- 20% des frais reçus
  solde_missionnaire numeric(12,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- PAIEMENTS (prélèvement 20% via FedaPay) ----------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  mission_id        uuid not null references public.missions(id) on delete cascade,
  montant           numeric(12,2) not null,   -- = prelevement_20
  telephone         text not null,            -- numéro MoMo débité
  fedapay_tx_id     text,                     -- id transaction FedaPay
  status            payment_status not null default 'initie',
  raw_webhook       jsonb,                    -- payload brut du webhook (audit)
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz
);

-- ---------- TIMESHEETS ----------
create table public.timesheets (
  id              uuid primary key default gen_random_uuid(),
  prestataire_id  uuid not null references public.profiles(id),
  manager_id      uuid not null references public.profiles(id), -- responsable direct
  periode_mois    int not null,    -- 1..12
  periode_annee   int not null,
  lignes          jsonb not null,  -- [{date, activite, heures, imputation}]
  total_heures    numeric(8,2),
  status          timesheet_status not null default 'soumis',
  commentaire_validation text,
  valide_le       timestamptz,
  created_at      timestamptz not null default now()
);

-- ---------- NOTIFICATIONS (dashboard + déclencheur email) ----------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  titre       text not null,
  message     text not null,
  lien        text,
  lu          boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index idx_missions_missionnaire on public.missions(missionnaire_id);
create index idx_missions_status on public.missions(status);
create index idx_timesheets_prestataire on public.timesheets(prestataire_id);
create index idx_timesheets_manager on public.timesheets(manager_id);
create index idx_notifications_user on public.notifications(user_id) where lu = false;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.missions      enable row level security;
alter table public.payments      enable row level security;
alter table public.timesheets    enable row level security;
alter table public.notifications enable row level security;

-- Helper : rôle de l'utilisateur courant
create or replace function public.current_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ----- PROFILES -----
create policy "lire son profil ou tout si caf/de/admin"
  on public.profiles for select using (
    id = auth.uid()
    or public.current_role() in ('caf','de','admin','manager')
  );
create policy "modifier son profil"
  on public.profiles for update using (id = auth.uid());
create policy "admin gère les profils"
  on public.profiles for all using (public.current_role() = 'admin');

-- ----- MISSIONS -----
create policy "missionnaire voit ses missions"
  on public.missions for select using (
    missionnaire_id = auth.uid()
    or public.current_role() in ('caf','de','admin')
  );
create policy "missionnaire crée/modifie ses brouillons"
  on public.missions for insert with check (missionnaire_id = auth.uid());
create policy "missionnaire modifie ses missions non clôturées"
  on public.missions for update using (
    (missionnaire_id = auth.uid() and status not in ('cloture'))
    or public.current_role() in ('caf','de','admin')
  );

-- ----- PAYMENTS -----
create policy "voir paiements de ses missions ou caf/de"
  on public.payments for select using (
    exists (select 1 from public.missions m
            where m.id = payments.mission_id
              and (m.missionnaire_id = auth.uid()
                   or public.current_role() in ('caf','de','admin')))
  );

-- ----- TIMESHEETS -----
create policy "prestataire et son manager voient le timesheet"
  on public.timesheets for select using (
    prestataire_id = auth.uid()
    or manager_id = auth.uid()
    or public.current_role() in ('caf','de','admin')
  );
create policy "prestataire soumet son timesheet"
  on public.timesheets for insert with check (prestataire_id = auth.uid());
create policy "manager valide, prestataire corrige"
  on public.timesheets for update using (
    manager_id = auth.uid()
    or (prestataire_id = auth.uid() and status in ('corrections','rejete'))
    or public.current_role() in ('admin')
  );

-- ----- NOTIFICATIONS -----
create policy "voir ses notifications"
  on public.notifications for select using (user_id = auth.uid());
create policy "marquer lu"
  on public.notifications for update using (user_id = auth.uid());

-- =====================================================================
-- TRIGGER : créer le profil à l'inscription
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nom, prenoms, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nom',''),
          coalesce(new.raw_user_meta_data->>'prenoms',''),
          new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- TRIGGER : calcul automatique du point financier + 20%
-- =====================================================================
create or replace function public.compute_reconciliation()
returns trigger language plpgsql as $$
begin
  -- total des dépenses = somme des montants du point financier
  if new.point_financier is not null then
    select coalesce(sum((elem->>'montant')::numeric),0)
      into new.total_depenses
      from jsonb_array_elements(new.point_financier) elem;
  end if;

  -- Prélèvement 20% UNIQUEMENT si à charge d'un partenaire
  -- Règle ABED : 20% des frais reçus du partenaire
  if new.a_charge_partenaire and new.montant_recu is not null then
    new.prelevement_20 := round(new.montant_recu * 0.20, 0);
    new.solde_missionnaire := new.montant_recu - coalesce(new.total_depenses,0) - new.prelevement_20;
  else
    new.prelevement_20 := 0;
    new.solde_missionnaire := coalesce(new.montant_recu,0) - coalesce(new.total_depenses,0);
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger trg_compute_reconciliation
  before insert or update on public.missions
  for each row execute function public.compute_reconciliation();
