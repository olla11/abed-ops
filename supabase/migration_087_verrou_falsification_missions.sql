-- Migration 087 : ferme la faille de falsification de données financières
-- trouvée sur missions — même famille que la migration 086 (profiles),
-- mais ici c'est l'intégrité financière d'un ordre de mission qui est en
-- jeu, pas un niveau d'accès.
--
-- La policy RLS "missionnaire modifie ses missions non cloturees" laisse
-- un missionnaire modifier N'IMPORTE QUELLE colonne de sa propre mission
-- tant qu'elle n'est pas au statut 'cloture' — aucune restriction sur les
-- colonnes elles-mêmes. Vérifié en base (transaction annulée avant tout
-- enregistrement) : un missionnaire pouvait, sur sa propre mission encore
-- "signe", réécrire directement montant_recu (ex. 999 999 F CFA) ET
-- signe_par (en y mettant son propre id, forgeant ainsi sa propre
-- signature comme si un CAF/DE avait validé la mission).
--
-- Vérification du code : aucun composant client n'appelle jamais
-- .from('missions').update(...) directement — toutes les écritures
-- légitimes passent par des routes serveur, qui utilisent soit le
-- service_role (donc hors RLS — le correctif ci-dessous ne les affecte
-- pas), soit un accès réservé aux rôles caf/de/dp/admin/administrateur.
-- La branche "missionnaire self-service" de la policy n'est donc utilisée
-- par aucune fonctionnalité actuelle — elle ne fait qu'exposer une
-- surface d'attaque directe (Supabase client standard, comme pour la
-- faille profiles).
--
-- Correctif : un trigger BEFORE UPDATE qui, quand un missionnaire modifie
-- SA PROPRE mission (et n'a pas un rôle de confiance), fige les colonnes
-- de statut/signature/finances à leur valeur précédente. N'affecte pas
-- les routes qui utilisent le service_role (reconciliation, signature,
-- clôture, paiement FedaPay) ni celles réservées à caf/de/dp/admin.

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_mission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acteur_role user_role;
BEGIN
  IF OLD.missionnaire_id = auth.uid() THEN
    SELECT role INTO acteur_role FROM public.profiles WHERE id = auth.uid();
    IF acteur_role IS NULL OR acteur_role NOT IN ('caf', 'de', 'dp', 'admin', 'administrateur', 'superadmin') THEN
      NEW.status                        := OLD.status;
      NEW.signe_par                     := OLD.signe_par;
      NEW.signe_le                      := OLD.signe_le;
      NEW.om_pdf_url                    := OLD.om_pdf_url;
      NEW.reconciliation_due_at         := OLD.reconciliation_due_at;
      NEW.montant_recu                  := OLD.montant_recu;
      NEW.total_depenses                := OLD.total_depenses;
      NEW.prelevement_20                := OLD.prelevement_20;
      NEW.solde_missionnaire            := OLD.solde_missionnaire;
      NEW.point_financier               := OLD.point_financier;
      NEW.rapport                       := OLD.rapport;
      NEW.mode_financement              := OLD.mode_financement;
      NEW.reconciliation_commentaire    := OLD.reconciliation_commentaire;
      NEW.reconciliation_pieces_jointes := OLD.reconciliation_pieces_jointes;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_mission ON public.missions;
CREATE TRIGGER trg_proteger_colonnes_sensibles_mission
  BEFORE UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_mission();
