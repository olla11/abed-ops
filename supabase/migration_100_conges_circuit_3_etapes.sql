-- Circuit congés à 3 étapes distinctes : responsable technique (N1) → RH ou
-- CAF (estRH() couvre déjà les deux) → DE. Nouveau statut intermédiaire
-- 'valide_rh' entre 'approuve_n1' (N1 fait) et 'approuve' (DE fait, final) —
-- statut géré côté application (colonne texte libre, pas d'enum à migrer).
-- Colonnes d'audit par étape, sur le même modèle que les autres circuits de
-- l'app (réconciliations OM, Pay Roll) : qui a validé et quand, pas
-- seulement le statut courant.

alter table conges
  add column if not exists valideur_n1_le timestamptz,
  add column if not exists valideur_rh_id uuid references profiles(id),
  add column if not exists valideur_rh_le timestamptz,
  add column if not exists valideur_final_le timestamptz;

-- Visibilité RLS : ajoute le valideur RH/CAF désigné (une fois l'étape N1
-- franchie) et superadmin, manquant jusqu'ici. ALTER POLICY (pas DROP +
-- CREATE) pour modifier en place.
alter policy "conges_visibility" on conges using (
  (profile_id = auth.uid())
  OR (valideur_n1_id = auth.uid())
  OR (valideur_rh_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['rh','admin','de','dp','administrateur','caf','superadmin']::user_role[])
  ))
);

-- Trigger anti-falsification : ajoute 'caf'/'superadmin' (CAF hérite des
-- pouvoirs RH partout ailleurs dans l'app, devait déjà pouvoir agir ici) et
-- protège les nouvelles colonnes d'audit au même titre que les anciennes.
create or replace function public.proteger_colonnes_sensibles_conge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acteur_role user_role;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into acteur_role from public.profiles where id = auth.uid();

  if not coalesce(
    old.valideur_n1_id = auth.uid()
    or old.valideur_rh_id = auth.uid()
    or (acteur_role is not null and acteur_role in ('rh', 'caf', 'de', 'dp', 'administrateur', 'admin', 'superadmin')),
    false
  ) then
    new.statut               := old.statut;
    new.valideur_n1_id       := old.valideur_n1_id;
    new.valideur_n1_le       := old.valideur_n1_le;
    new.valideur_rh_id       := old.valideur_rh_id;
    new.valideur_rh_le       := old.valideur_rh_le;
    new.valideur_final_id    := old.valideur_final_id;
    new.valideur_final_le    := old.valideur_final_le;
    new.commentaire_valideur := old.commentaire_valideur;
  end if;

  return new;
end $$;
