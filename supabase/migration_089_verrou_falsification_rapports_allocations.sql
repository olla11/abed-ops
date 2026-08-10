-- Migration 089 : ferme la même faille que 087/088, sur rapports_allocations
-- (circuit de validation à 4 niveaux : manager → AAF → CAF → DE).
--
-- La policy RLS "update_rapports_alloc" laisse le manager assigné, ou
-- tout compte aaf/caf/de/dp/admin, écrire N'IMPORTE QUELLE colonne du
-- rapport — alors que l'application elle-même (route valider/route.ts)
-- applique un circuit strict étape par étape, avec des colonnes propres
-- à chaque niveau.
--
-- Vérifié en base (transaction annulée avant tout enregistrement) : le
-- simple manager assigné à un rapport pouvait, en une seule requête,
-- passer son statut directement à "autorise", fixer un montant
-- d'allocation de 9 000 000 F CFA, et forger aaf_id/caf_id/de_id avec
-- son propre id — validant seul, en une fois, un circuit censé passer
-- par 4 personnes différentes.
--
-- Correctif : verrouille chaque tranche de colonnes au(x) rôle(s) qui la
-- possède réellement dans la route de validation :
--   - aaf_id/aaf_le/commentaire_aaf + montant_allocation (décision AAF) : aaf/caf/admin
--   - caf_id/caf_le/commentaire_caf : caf/admin
--   - de_id/de_le/commentaire_de (autorisation finale) : de/administrateur/admin
--   - manager_valide_le/commentaire_manager : le responsable assigné du
--     dossier (manager_id), ou admin.
-- Les routes admin en service_role restent hors périmètre (auth.uid() y
-- est nul).

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
    RETURN NEW; -- service_role (routes admin) — hors périmètre de ce verrou
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

  IF NOT (
    OLD.manager_id = auth.uid()
    OR (acteur_role IS NOT NULL AND acteur_role IN ('admin', 'superadmin'))
  ) THEN
    NEW.manager_valide_le   := OLD.manager_valide_le;
    NEW.commentaire_manager := OLD.commentaire_manager;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_rapport_allocation ON public.rapports_allocations;
CREATE TRIGGER trg_proteger_colonnes_sensibles_rapport_allocation
  BEFORE UPDATE ON public.rapports_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_rapport_allocation();
