-- Migration 010 : correctifs RLS soumissions + enum om_status reconciliation_caf

-- 1. Ajouter reconciliation_caf à l'enum om_status
ALTER TYPE om_status ADD VALUE IF NOT EXISTS 'reconciliation_caf';

-- 2. Corriger la RLS UPDATE sur soumissions
-- Le problème : USING sans WITH CHECK → le WITH CHECK par défaut empêche de passer status à 'soumis'
-- Solution : WITH CHECK séparé qui autorise le prestataire à repasser en 'soumis'
DROP POLICY IF EXISTS "manager valide / prestataire corrige / caf valide" ON public.soumissions;
DROP POLICY IF EXISTS "manager valide / prestataire corrige" ON public.soumissions;

CREATE POLICY "soumissions update"
  ON public.soumissions FOR UPDATE
  USING (
    manager_id = auth.uid()
    OR prestataire_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('caf', 'admin', 'de')
  )
  WITH CHECK (
    manager_id = auth.uid()
    OR prestataire_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('caf', 'admin', 'de')
  );
