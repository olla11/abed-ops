-- La CAF hérite intégralement du menu AAF, y compris la création de bons de
-- commande (pas seulement leur consultation, déjà couverte par la policy
-- SELECT existante depuis migration_111).
DROP POLICY write_bons_de_commande ON bons_de_commande;
CREATE POLICY write_bons_de_commande ON bons_de_commande FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('aaf','caf','admin','superadmin'))
);

DROP POLICY write_bon_de_commande_lignes ON bon_de_commande_lignes;
CREATE POLICY write_bon_de_commande_lignes ON bon_de_commande_lignes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('aaf','caf','admin','superadmin'))
);
