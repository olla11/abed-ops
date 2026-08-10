-- Migration 088 : ferme la faille de falsification la plus grave trouvée
-- dans cet audit — même famille que 086/087, sur la table soumissions
-- (timesheets/factures prestataires).
--
-- La policy RLS "soumissions update" a un WITH CHECK, mais il est
-- identique au USING : il vérifie seulement QUI peut toucher la ligne
-- (son propre dossier en tant que prestataire, son équipe en tant que
-- manager, ou un rôle caf/admin/de/dp), jamais QUOI peut être changé.
--
-- Vérifié en base (transaction annulée avant tout enregistrement) : un
-- prestataire pouvait, sur sa propre soumission, se marquer lui-même
-- "validé technique", "validé CAF" ET "payé", avec un montant choisi
-- librement (5 000 000 F CFA dans le test) — en forgeant valide_par,
-- caf_valide_par et paye_par avec son propre id. Complètement invisible
-- pour un manager ou la CAF : rien dans l'appli n'aurait jamais déclenché
-- cette écriture, mais rien ne l'empêchait non plus côté base.
--
-- Vérification du code des routes qui valident légitimement ces
-- colonnes (valider-tech, valider-caf, payer) : elles utilisent le
-- client lié à la session (pas service_role) et s'appuient donc
-- directement sur cette policy RLS pour leur autorisation — d'où la
-- distinction à deux niveaux ci-dessous plutôt qu'un verrou uniforme :
--   - colonnes CAF/paiement (montant, montant_caf, paye*, caf_valide_*,
--     commentaire_caf) : réservées à caf/admin/de/dp, y compris pour le
--     manager de la soumission.
--   - colonnes de validation technique (status, valide_par/le,
--     heures_retenues, justification_heures, commentaire_manager,
--     corrige_le) : réservées au manager du dossier (ou plus) — jamais
--     au prestataire lui-même.
-- Les routes admin en service_role (corriger, resoumettre, suppression
-- de compte) restent hors de portée de ce trigger (auth.uid() y est nul).

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
    RETURN NEW; -- service_role (routes admin) — hors périmètre de ce verrou
  END IF;

  SELECT role INTO acteur_role FROM public.profiles WHERE id = auth.uid();

  -- Colonnes CAF / paiement : jamais touchables par le prestataire ni son manager.
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

  -- Colonnes de validation technique : réservées au manager du dossier (ou plus).
  IF NOT (
    OLD.manager_id = auth.uid()
    OR (acteur_role IS NOT NULL AND acteur_role IN ('caf', 'admin', 'de', 'dp', 'superadmin'))
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

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_soumission ON public.soumissions;
CREATE TRIGGER trg_proteger_colonnes_sensibles_soumission
  BEFORE UPDATE ON public.soumissions
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_soumission();
