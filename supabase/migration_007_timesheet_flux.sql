-- =====================================================================
-- Migration 007 : Refonte flux timesheet
-- Prestataire soumet 3 fichiers → Manager valide techniquement → CAF valide facture
-- =====================================================================

-- Nouveaux statuts pour le flux en deux étapes
ALTER TYPE livrable_status ADD VALUE IF NOT EXISTS 'valide_tech';
ALTER TYPE livrable_status ADD VALUE IF NOT EXISTS 'corrections_tech';
ALTER TYPE livrable_status ADD VALUE IF NOT EXISTS 'rejete_tech';
ALTER TYPE livrable_status ADD VALUE IF NOT EXISTS 'valide_caf';
ALTER TYPE livrable_status ADD VALUE IF NOT EXISTS 'corrections_caf';
ALTER TYPE livrable_status ADD VALUE IF NOT EXISTS 'rejete_caf';

-- Nouvelles colonnes sur soumissions
ALTER TABLE public.soumissions
  ADD COLUMN IF NOT EXISTS fichier_timesheet_url  text,   -- Excel timesheet
  ADD COLUMN IF NOT EXISTS fichier_livrable_url   text,   -- PDF livrable
  ADD COLUMN IF NOT EXISTS fichier_facture_url    text,   -- PDF facture
  ADD COLUMN IF NOT EXISTS heures_declarees       numeric(8,2),
  ADD COLUMN IF NOT EXISTS heures_retenues        numeric(8,2),
  ADD COLUMN IF NOT EXISTS justification_heures   text,
  ADD COLUMN IF NOT EXISTS montant_caf            numeric(12,2),  -- heures_retenues × 1500
  ADD COLUMN IF NOT EXISTS commentaire_manager    text,
  ADD COLUMN IF NOT EXISTS commentaire_caf        text,
  ADD COLUMN IF NOT EXISTS caf_valide_par         uuid references public.profiles(id),
  ADD COLUMN IF NOT EXISTS caf_valide_le          timestamptz;

-- RLS : CAF peut désormais mettre à jour les soumissions valide_tech
DROP POLICY IF EXISTS "manager valide / prestataire corrige" ON public.soumissions;
CREATE POLICY "manager valide / prestataire corrige / caf valide"
  ON public.soumissions FOR UPDATE USING (
    manager_id = auth.uid()
    OR (prestataire_id = auth.uid()
        AND status IN ('corrections', 'corrections_tech', 'corrections_caf', 'rejete', 'rejete_tech', 'rejete_caf'))
    OR public.current_role() IN ('caf', 'admin')
  );

-- Bucket Storage timesheets (à créer manuellement si pas déjà fait)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('timesheets', 'timesheets', false) ON CONFLICT DO NOTHING;
