-- Migration 092 : corrige un bug introduit par moi-même dans les migrations
-- 088, 089 et 091 — trouvé en testant le correctif de conges.
--
-- Le motif `IF NOT (OLD.manager_id = auth.uid() OR ...)` a un piège classique
-- de logique à 3 valeurs en SQL : si OLD.manager_id (ou valideur_n1_id) est
-- NULL, `OLD.x = auth.uid()` s'évalue à NULL — pas FALSE. Si le second
-- membre du OR est aussi FALSE, tout le OR vaut NULL, et `IF NOT NULL`
-- s'évalue lui-même à NULL, que PL/pgSQL traite comme "pas vrai" : le bloc
-- de protection ne s'exécute JAMAIS dans ce cas, laissant la colonne
-- totalement déverrouillée au lieu de verrouillée.
--
-- Impact réel vérifié :
--  - conges.valideur_n1_id est nullable ET la policy RLS laisse le
--    demandeur (profile_id = auth.uid()) entrer indépendamment de ce
--    champ — donc CE piège annulait complètement le correctif de la
--    migration 091 : un employé pouvait toujours s'auto-approuver un
--    congé fraîchement soumis (avant qu'un valideur N1 soit assigné).
--    Vérifié avec une ligne de test (insérée puis annulée) avant et
--    après ce correctif.
--  - soumissions.manager_id est NOT NULL en base — ce piège n'y était
--    donc pas exploitable en pratique, corrigé par cohérence/prudence.
--  - rapports_allocations.manager_id est nullable, mais la policy RLS
--    n'admet dans ce cas que les rôles déjà privilégiés (aaf/caf/de/dp/
--    admin) — pas exploitable par un compte non privilégié non plus,
--    corrigé par la même cohérence.
--
-- Correctif : remplace `IF NOT (x OR y)` par `IF NOT COALESCE(x OR y, false)`
-- partout où x peut être NULL — la protection s'applique désormais aussi
-- quand aucun valideur/manager n'est encore assigné.

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_conge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acteur_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO acteur_role FROM public.profiles WHERE id = auth.uid();

  IF NOT COALESCE(
    OLD.valideur_n1_id = auth.uid()
    OR (acteur_role IS NOT NULL AND acteur_role IN ('rh', 'de', 'dp', 'administrateur', 'admin', 'superadmin')),
    false
  ) THEN
    NEW.statut               := OLD.statut;
    NEW.valideur_n1_id       := OLD.valideur_n1_id;
    NEW.valideur_final_id    := OLD.valideur_final_id;
    NEW.commentaire_valideur := OLD.commentaire_valideur;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_soumission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acteur_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO acteur_role FROM public.profiles WHERE id = auth.uid();

  IF acteur_role IS NULL OR acteur_role NOT IN ('caf', 'admin', 'de', 'dp', 'superadmin') THEN
    NEW.montant         := OLD.montant;
    NEW.montant_caf     := OLD.montant_caf;
    NEW.paye            := OLD.paye;
    NEW.paye_le         := OLD.paye_le;
    NEW.paye_par        := OLD.paye_par;
    NEW.caf_valide_par  := OLD.caf_valide_par;
    NEW.caf_valide_le   := OLD.caf_valide_le;
    NEW.commentaire_caf := OLD.commentaire_caf;
  END IF;

  IF NOT COALESCE(
    OLD.manager_id = auth.uid()
    OR (acteur_role IS NOT NULL AND acteur_role IN ('caf', 'admin', 'de', 'dp', 'superadmin')),
    false
  ) THEN
    NEW.status              := OLD.status;
    NEW.valide_par          := OLD.valide_par;
    NEW.valide_le           := OLD.valide_le;
    NEW.heures_retenues     := OLD.heures_retenues;
    NEW.justification_heures := OLD.justification_heures;
    NEW.commentaire_manager := OLD.commentaire_manager;
    NEW.corrige_le          := OLD.corrige_le;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_rapport_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acteur_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO acteur_role FROM public.profiles WHERE id = auth.uid();

  IF acteur_role IS NULL OR acteur_role NOT IN ('aaf', 'caf', 'admin', 'superadmin') THEN
    NEW.aaf_id             := OLD.aaf_id;
    NEW.aaf_le             := OLD.aaf_le;
    NEW.commentaire_aaf    := OLD.commentaire_aaf;
    NEW.montant_allocation := OLD.montant_allocation;
  END IF;

  IF acteur_role IS NULL OR acteur_role NOT IN ('caf', 'admin', 'superadmin') THEN
    NEW.caf_id          := OLD.caf_id;
    NEW.caf_le          := OLD.caf_le;
    NEW.commentaire_caf := OLD.commentaire_caf;
  END IF;

  IF acteur_role IS NULL OR acteur_role NOT IN ('de', 'administrateur', 'admin', 'superadmin') THEN
    NEW.de_id          := OLD.de_id;
    NEW.de_le          := OLD.de_le;
    NEW.commentaire_de := OLD.commentaire_de;
  END IF;

  IF NOT COALESCE(
    OLD.manager_id = auth.uid()
    OR (acteur_role IS NOT NULL AND acteur_role IN ('admin', 'superadmin')),
    false
  ) THEN
    NEW.manager_valide_le   := OLD.manager_valide_le;
    NEW.commentaire_manager := OLD.commentaire_manager;
  END IF;

  RETURN NEW;
END $$;
