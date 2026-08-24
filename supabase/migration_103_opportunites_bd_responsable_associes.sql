-- Migration 103 : responsable de soumission + associés désignés dans le
-- système (au lieu du texte libre) + type d'opportunité (Appel à Projets /
-- AMI) sur opportunites_bd. Aucune donnée réelle encore en base sur cette
-- table (import historique du registre Excel pas encore fait) — on peut
-- donc remplacer personnes_associees (texte libre) sans migration de données.

create type opportunite_bd_type as enum ('appel_a_projets', 'ami');

alter table public.opportunites_bd
  add column type_opportunite opportunite_bd_type not null default 'appel_a_projets',
  add column responsable_id uuid references public.profiles(id),
  add column associes_ids uuid[] not null default '{}'::uuid[];

alter table public.opportunites_bd drop column personnes_associees;

create index idx_opportunites_bd_responsable on public.opportunites_bd(responsable_id);
