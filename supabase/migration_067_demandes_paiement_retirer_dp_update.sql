-- Seuls AAF, CAF et DE (+ admin en secours technique) ont une action réelle
-- sur le circuit des demandes de paiement. Le DP n'y traite plus rien (voir
-- aussi rapports_allocations pour la même règle métier).
DROP POLICY IF EXISTS "update_demandes" ON demandes_paiement;
CREATE POLICY "update_demandes"
  ON demandes_paiement FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aaf','caf','de','admin')));
