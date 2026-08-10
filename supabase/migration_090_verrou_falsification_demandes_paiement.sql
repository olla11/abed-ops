-- Migration 090 : même famille que 087/088/089, sur demandes_paiement
-- (circuit AAF → CAF → DE).
--
-- La policy RLS "update_demandes" autorise tout compte aaf/caf/de/admin à
-- écrire N'IMPORTE QUELLE colonne d'une demande de paiement — y compris
-- le montant demandé lui-même, et les tampons d'approbation des étapes
-- suivantes (un AAF pouvait forger caf_id/de_id et faire passer une
-- demande directement à "autorise").
--
-- Correctif, même logique que la migration 089 :
--  - aaf_id/aaf_le/commentaire_aaf : aaf/caf/admin (CAF hérite AAF)
--  - caf_id/caf_le/commentaire_caf : caf/admin
--  - de_id/de_le/commentaire_de (autorisation finale) : de/admin
--  - le contenu original de la demande (montant, bénéficiaire, objet,
--    justification, etc.) : verrouillé pour les 3 rôles traiteurs — ils
--    approuvent la demande, ils ne la réécrivent pas. Seul admin/superadmin
--    y touche (secours technique).
-- Routes admin en service_role hors périmètre (auth.uid() y est nul).

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_demande_paiement()
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
    NEW.aaf_id          := OLD.aaf_id;
    NEW.aaf_le          := OLD.aaf_le;
    NEW.commentaire_aaf := OLD.commentaire_aaf;
  END IF;

  IF acteur_role IS NULL OR acteur_role NOT IN ('caf', 'admin', 'superadmin') THEN
    NEW.caf_id          := OLD.caf_id;
    NEW.caf_le          := OLD.caf_le;
    NEW.commentaire_caf := OLD.commentaire_caf;
  END IF;

  IF acteur_role IS NULL OR acteur_role NOT IN ('de', 'admin', 'superadmin') THEN
    NEW.de_id          := OLD.de_id;
    NEW.de_le          := OLD.de_le;
    NEW.commentaire_de := OLD.commentaire_de;
  END IF;

  -- Le contenu original de la demande n'est jamais réécrit par les
  -- traiteurs (aaf/caf/de) — seuls la demande initiale ou admin y touchent.
  IF acteur_role IS NULL OR acteur_role NOT IN ('admin', 'superadmin') THEN
    NEW.montant                  := OLD.montant;
    NEW.beneficiaire             := OLD.beneficiaire;
    NEW.objet                    := OLD.objet;
    NEW.justification            := OLD.justification;
    NEW.code_budgetaire          := OLD.code_budgetaire;
    NEW.nature_depense           := OLD.nature_depense;
    NEW.mode_paiement            := OLD.mode_paiement;
    NEW.reference_piece          := OLD.reference_piece;
    NEW.fichier_justificatif_url := OLD.fichier_justificatif_url;
    NEW.demandeur_id             := OLD.demandeur_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_demande_paiement ON public.demandes_paiement;
CREATE TRIGGER trg_proteger_colonnes_sensibles_demande_paiement
  BEFORE UPDATE ON public.demandes_paiement
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_demande_paiement();
