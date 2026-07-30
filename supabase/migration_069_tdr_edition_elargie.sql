-- Édition élargie du contenu des TDR : n'importe quel signataire (pas
-- seulement celui dont c'est le tour) peut désormais modifier les chapitres
-- à n'importe quel statut (pas seulement en brouillon). La RLS doit suivre
-- la même règle métier que la route API (voir src/app/api/tdrs/[id]/route.ts).
DROP POLICY IF EXISTS "tdrs_update" ON tdrs;
CREATE POLICY "tdrs_update" ON tdrs FOR UPDATE TO authenticated USING (
  initiateur_id = auth.uid()
  OR EXISTS (SELECT 1 FROM tdr_collaborateurs c WHERE c.tdr_id = id AND c.profile_id = auth.uid() AND c.permission = 'revision')
  OR EXISTS (SELECT 1 FROM tdr_signataires s WHERE s.tdr_id = id AND s.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'caf'))
);

-- Indicateur "dernière modification par" affiché sur la page du TDR.
ALTER TABLE tdrs ADD COLUMN IF NOT EXISTS derniere_modif_par uuid REFERENCES profiles(id) ON DELETE SET NULL;
