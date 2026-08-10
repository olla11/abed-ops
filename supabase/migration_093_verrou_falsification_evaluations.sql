-- Migration 093 : même famille que 087-091, sur evaluations.
--
-- La policy RLS "evaluation_visibility" (ALL) laisse la personne évaluée
-- (profile_id) modifier n'importe quelle colonne de sa propre évaluation
-- — y compris les champs qui ne lui appartiennent pas : la note de
-- l'évaluateur (grille_notes, score_moyen), sa signature, et la décision
-- finale RH/DE (decision_rh, decision_de) qui influence son propre
-- dossier professionnel.
--
-- Vérification du code (/api/evaluations/[id]) : la route écrit via le
-- service_role, pas le client de session — la branche "profile_id =
-- auth.uid()" de cette policy n'est utilisée par aucune fonctionnalité
-- actuelle. Le circuit réel autorise soit l'évaluateur assigné
-- (evaluateur_id), soit rh/admin/de/dp — jamais l'évalué lui-même — pour
-- les champs évaluateur ET pour l'avis/la décision finale (le même
-- évaluateur peut aussi jouer le rôle de "responsable").
--
-- Correctif : verrouille les champs d'évaluation/décision pour quiconque
-- n'est pas l'évaluateur assigné du dossier ni rh/de/dp/admin.

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_evaluation()
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
    OLD.evaluateur_id = auth.uid()
    OR (acteur_role IS NOT NULL AND acteur_role IN ('rh', 'admin', 'de', 'dp', 'superadmin')),
    false
  ) THEN
    NEW.grille_notes            := OLD.grille_notes;
    NEW.score_moyen             := OLD.score_moyen;
    NEW.qualites                := OLD.qualites;
    NEW.points_amelioration     := OLD.points_amelioration;
    NEW.actions_exceptionnelles := OLD.actions_exceptionnelles;
    NEW.evaluation_generale     := OLD.evaluation_generale;
    NEW.commentaire_evaluateur  := OLD.commentaire_evaluateur;
    NEW.signature_evaluateur    := OLD.signature_evaluateur;
    NEW.date_evaluateur         := OLD.date_evaluateur;
    NEW.decision_evaluateur     := OLD.decision_evaluateur;
    NEW.avis_responsable        := OLD.avis_responsable;
    NEW.commentaire_responsable := OLD.commentaire_responsable;
    NEW.signature_responsable   := OLD.signature_responsable;
    NEW.date_responsable        := OLD.date_responsable;
    NEW.decision_rh             := OLD.decision_rh;
    NEW.decision_de             := OLD.decision_de;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_evaluation ON public.evaluations;
CREATE TRIGGER trg_proteger_colonnes_sensibles_evaluation
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_evaluation();
