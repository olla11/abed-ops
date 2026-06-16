-- Ré-insère les types de congé par défaut si la table est vide (cas où la
-- migration 024 n'avait pas été exécutée correctement en production).
INSERT INTO types_conge (nom, jours_annuels) VALUES
  ('Congé annuel', 30),
  ('Congé maladie', 15),
  ('Congé maternité', 98),
  ('Congé paternité', 3),
  ('Congé sans solde', 0)
ON CONFLICT DO NOTHING;

-- Workflow congés : Employé -> RH (validation N1) -> DE (autorisation finale).
-- Le DE doit pouvoir voir/valider les congés au même titre que RH/admin.
DROP POLICY IF EXISTS "conges_visibility" ON conges;
CREATE POLICY "conges_visibility" ON conges USING (
  profile_id = auth.uid() OR
  valideur_n1_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh', 'admin', 'de', 'administrateur'))
);
