-- Migration 095 : même famille que 087-094, sur tdrs.
--
-- La policy "tdrs_update" laisse l'initiateur, un collaborateur en
-- révision, ou n'importe quel signataire modifier n'importe quelle
-- colonne du TDR — y compris statut, les tampons de clôture
-- (cloture_par/cloture_le), de refus (dernier_refus_*), et archive_le
-- (la colonne ajoutée en migration 083 pour l'archivage automatique,
-- censée n'être touchée que par le cron annuel).
--
-- Vérification du code : soumettre, refuser, cloturer et
-- changer-responsable-technique écrivent tous via le service_role.
-- La route PATCH /api/tdrs/[id] (seule à utiliser le client de session)
-- ne touche jamais ces colonnes — uniquement titre_activite/projet/
-- periode/chapitres, exactement ce que ce correctif laisse ouvert.
--
-- Correctif : verrouille statut/numero/responsable_technique_id/
-- dernier_refus_*/cloture_*/archive_le pour quiconque n'est pas admin/caf
-- (les seuls rôles déjà reconnus par la policy elle-même, en dehors du
-- lien personnel initiateur/collaborateur/signataire).

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_tdr()
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

  IF acteur_role IS NULL OR acteur_role NOT IN ('admin', 'caf', 'superadmin') THEN
    NEW.numero                     := OLD.numero;
    NEW.statut                     := OLD.statut;
    NEW.responsable_technique_id   := OLD.responsable_technique_id;
    NEW.dernier_refus_par          := OLD.dernier_refus_par;
    NEW.dernier_refus_commentaire  := OLD.dernier_refus_commentaire;
    NEW.dernier_refus_le           := OLD.dernier_refus_le;
    NEW.cloture_par                := OLD.cloture_par;
    NEW.cloture_le                 := OLD.cloture_le;
    NEW.cloture_notes              := OLD.cloture_notes;
    NEW.archive_le                 := OLD.archive_le;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_tdr ON public.tdrs;
CREATE TRIGGER trg_proteger_colonnes_sensibles_tdr
  BEFORE UPDATE ON public.tdrs
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_tdr();
