-- Migration 037: Projets internes (suivi de projets type ClickUp)

create table if not exists projets_internes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text,
  statut text not null default 'en_cours' check (statut in ('planifie','en_cours','en_pause','termine','annule')),
  date_debut date,
  date_fin date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists activites (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid references projets_internes(id) on delete cascade not null,
  nom text not null,
  description text,
  statut text not null default 'a_faire' check (statut in ('a_faire','en_cours','en_revue','termine')),
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute','urgente')),
  assignee_id uuid references profiles(id) on delete set null,
  date_echeance date,
  ordre int default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists commentaires_activites (
  id uuid primary key default gen_random_uuid(),
  activite_id uuid references activites(id) on delete cascade not null,
  auteur_id uuid references profiles(id) on delete set null,
  contenu text not null,
  created_at timestamptz default now()
);

alter table projets_internes enable row level security;
alter table activites enable row level security;
alter table commentaires_activites enable row level security;

create policy "projets_select" on projets_internes for select to authenticated using (true);
create policy "activites_select" on activites for select to authenticated using (true);
create policy "commentaires_select" on commentaires_activites for select to authenticated using (true);

create policy "projets_insert" on projets_internes for insert to authenticated with check (auth.uid() = created_by);
create policy "activites_insert" on activites for insert to authenticated with check (auth.uid() = created_by);
create policy "commentaires_insert" on commentaires_activites for insert to authenticated with check (auth.uid() = auteur_id);

create policy "projets_update" on projets_internes for update to authenticated using (auth.uid() = created_by);
create policy "activites_update" on activites for update to authenticated using (auth.uid() = created_by or auth.uid() = assignee_id);
create policy "commentaires_update" on commentaires_activites for update to authenticated using (auth.uid() = auteur_id);

create policy "projets_delete" on projets_internes for delete to authenticated using (auth.uid() = created_by);
create policy "activites_delete" on activites for delete to authenticated using (auth.uid() = created_by);
create policy "commentaires_delete" on commentaires_activites for delete to authenticated using (auth.uid() = auteur_id);

grant all on projets_internes to service_role;
grant all on activites to service_role;
grant all on commentaires_activites to service_role;

grant all on projets_internes to authenticated;
grant all on activites to authenticated;
grant all on commentaires_activites to authenticated;
