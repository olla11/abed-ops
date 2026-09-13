-- Le layout CAF Pro autorise déjà superadmin (comme admin) à accéder à
-- /caf/**, mais les policies d'écriture RLS posées en Phase 0 du chantier
-- Pay Roll ne listaient que caf/admin — un superadmin aurait pu passer le
-- contrôle applicatif (route API) et se faire bloquer ensuite par la base.
-- Même classe de bug que la vérification de rôle manquante trouvée plus tôt
-- sur les modèles de contrat ; corrigée avant qu'elle ne se reproduise.

DROP POLICY write_comptes_bancaires ON comptes_bancaires;
CREATE POLICY write_comptes_bancaires ON comptes_bancaires FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin','superadmin'))
);

DROP POLICY write_budget_adopte ON budget_adopte;
CREATE POLICY write_budget_adopte ON budget_adopte FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin','superadmin'))
);

DROP POLICY write_pay_roll ON pay_roll;
CREATE POLICY write_pay_roll ON pay_roll FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin','superadmin'))
);

DROP POLICY write_appels_de_fonds ON appels_de_fonds;
CREATE POLICY write_appels_de_fonds ON appels_de_fonds FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin','superadmin'))
);

DROP POLICY write_appel_de_fonds_lignes ON appel_de_fonds_lignes;
CREATE POLICY write_appel_de_fonds_lignes ON appel_de_fonds_lignes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin','superadmin'))
);
