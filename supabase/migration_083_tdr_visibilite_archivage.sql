-- Migration 083 : restreint la visibilité globale des TDR aux rôles
-- réellement concernés par leur circuit de validation (DE, AAF, CAF, DP,
-- Administrateur + admin/superadmin en secours technique), et ajoute
-- l'archivage automatique des TDR clôturés de l'année précédente (déclenché
-- chaque 31 janvier par un cron applicatif — voir vercel.json /
-- /api/cron/archiver-tdr).
--
-- Avant cette migration, can_access_tdr() rendait tout TDR actif ou clôturé
-- visible à N'IMPORTE QUEL compte connecté (`t.statut IN ('actif','cloture')`
-- sans condition de rôle) — un missionnaire voyait donc des TDR auxquels il
-- n'avait jamais participé. Désormais, seuls les rôles listés ci-dessous
-- gardent cette vision globale ; les autres ne voient que les TDR où ils
-- sont initiateur, collaborateur ou signataire.

ALTER TABLE tdrs ADD COLUMN IF NOT EXISTS archive_le timestamptz;

CREATE OR REPLACE FUNCTION public.can_access_tdr(p_tdr_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tdrs t
    WHERE t.id = p_tdr_id
    AND (
      t.initiateur_id = auth.uid()
      OR EXISTS (SELECT 1 FROM tdr_collaborateurs c WHERE c.tdr_id = t.id AND c.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM tdr_signataires s WHERE s.tdr_id = t.id AND s.profile_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('de', 'aaf', 'caf', 'dp', 'administrateur', 'admin', 'superadmin')
      )
    )
  );
$$;

-- Archive (sans les supprimer) les TDR clôturés d'une année civile révolue —
-- basé sur cloture_le (date réelle de clôture), avec repli sur updated_at
-- pour d'anciens TDR clôturés avant l'ajout de cette colonne.
CREATE OR REPLACE FUNCTION public.archiver_tdrs_annee_precedente()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nb int := 0;
BEGIN
  UPDATE public.tdrs
  SET archive_le = now()
  WHERE statut = 'cloture'
    AND archive_le IS NULL
    AND extract(year FROM coalesce(cloture_le, updated_at)) < extract(year FROM current_date);
  GET DIAGNOSTICS nb = ROW_COUNT;
  RETURN nb;
END $$;

GRANT EXECUTE ON FUNCTION public.archiver_tdrs_annee_precedente() TO service_role;
