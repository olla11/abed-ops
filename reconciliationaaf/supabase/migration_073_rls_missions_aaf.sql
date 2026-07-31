-- Migration 073 : l'AAF voit toutes les missions (nécessaire pour la validation de réconciliation)

ALTER POLICY "missions_select" ON missions USING (
  (auth.uid() = missionnaire_id) OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['caf','de','dp','admin','rh','aaf']::user_role[])))
);
