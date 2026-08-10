-- Migration 094 : même famille que 087-093, sur contrats — la plus
-- sensible de toutes après profiles, puisqu'elle expose le salaire.
--
-- La policy "contrats_rh" laisse l'employé (profile_id = auth.uid())
-- modifier n'importe quelle colonne de son propre contrat — y compris
-- salaire_base/salaire_brut, le statut du circuit de signature
-- (workflow_statut), et les tampons de signature (signe_employe_le,
-- signataire_id, signe_signataire_le) : un employé pouvait s'augmenter
-- lui-même sur le document, ou forger que le circuit de signature était
-- déjà complet.
--
-- Vérification du code : toutes les routes de contrat (signer-employe,
-- signer-signataire, refuser-*, action, rh/contrats, renouveler,
-- contrat-pdf) écrivent via le service_role — la branche "profile_id =
-- auth.uid()" de cette policy n'est utilisée par aucune fonctionnalité
-- actuelle, même pour la propre signature de l'employé.
--
-- Correctif : verrouille le contenu du contrat et le circuit de
-- signature pour quiconque n'est pas rh/caf/de/dp/admin (les rôles déjà
-- reconnus par la policy elle-même) — seul commentaires_employe reste
-- éditable par l'employé (son propre commentaire de refus).

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_contrat()
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

  IF acteur_role IS NULL OR acteur_role NOT IN ('rh', 'caf', 'de', 'dp', 'admin', 'superadmin') THEN
    NEW.type_contrat            := OLD.type_contrat;
    NEW.date_debut              := OLD.date_debut;
    NEW.date_fin                := OLD.date_fin;
    NEW.poste                   := OLD.poste;
    NEW.direction                := OLD.direction;
    NEW.salaire_base             := OLD.salaire_base;
    NEW.salaire_brut             := OLD.salaire_brut;
    NEW.statut                   := OLD.statut;
    NEW.renouvele_depuis         := OLD.renouvele_depuis;
    NEW.notes                    := OLD.notes;
    NEW.observations             := OLD.observations;
    NEW.categorie_document       := OLD.categorie_document;
    NEW.contrat_parent_id        := OLD.contrat_parent_id;
    NEW.objet                    := OLD.objet;
    NEW.articles                 := OLD.articles;
    NEW.commentaires_rh          := OLD.commentaires_rh;
    NEW.workflow_statut          := OLD.workflow_statut;
    NEW.signe_employe_le         := OLD.signe_employe_le;
    NEW.signataire_id            := OLD.signataire_id;
    NEW.commentaires_signataire  := OLD.commentaires_signataire;
    NEW.signe_signataire_le      := OLD.signe_signataire_le;
    NEW.demande_signature_id     := OLD.demande_signature_id;
    NEW.source_financement       := OLD.source_financement;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_contrat ON public.contrats;
CREATE TRIGGER trg_proteger_colonnes_sensibles_contrat
  BEFORE UPDATE ON public.contrats
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_contrat();
