-- Migration 091 : même famille que 087-090, sur conges.
--
-- La policy RLS "conges_visibility" (ALL) laisse l'employé (profile_id)
-- modifier n'importe quelle colonne de sa propre demande de congé — donc
-- s'auto-approuver (statut, valideur_n1_id, valideur_final_id).
--
-- Vérification du code : /api/conges/[id]/valider (le seul endroit qui
-- valide un congé) écrit exclusivement via le service_role, pas le
-- client lié à la session — la branche "profile_id = auth.uid()" de
-- cette policy n'est donc utilisée par AUCUNE fonctionnalité actuelle.
-- Vérifié avec une ligne de test insérée et annulée (aucune donnée
-- réelle touchée) : un employé pouvait faire passer statut à "approuve"
-- et se désigner lui-même valideur_final_id.
--
-- Correctif : verrouille statut/valideur_n1_id/valideur_final_id/
-- commentaire_valideur pour quiconque n'est pas RH/DE/DP/administrateur/
-- admin, ou le valideur N1 désigné du dossier.

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

  IF NOT (
    OLD.valideur_n1_id = auth.uid()
    OR (acteur_role IS NOT NULL AND acteur_role IN ('rh', 'de', 'dp', 'administrateur', 'admin', 'superadmin'))
  ) THEN
    NEW.statut               := OLD.statut;
    NEW.valideur_n1_id       := OLD.valideur_n1_id;
    NEW.valideur_final_id    := OLD.valideur_final_id;
    NEW.commentaire_valideur := OLD.commentaire_valideur;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_conge ON public.conges;
CREATE TRIGGER trg_proteger_colonnes_sensibles_conge
  BEFORE UPDATE ON public.conges
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_conge();
