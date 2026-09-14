-- Code budgétaire (document entier, comme dans Pay Roll) + type de
-- référence justificative (TDR / Contrat / Expression de besoin, cette
-- dernière sans source de données pour l'instant — juste le champ prévu) et
-- ses éléments sélectionnés, plusieurs possibles par bon de commande.
ALTER TABLE bons_de_commande ADD COLUMN code_budgetaire text REFERENCES codes_budgetaires(code);
ALTER TABLE bons_de_commande ADD COLUMN reference_type text CHECK (reference_type IN ('tdr','contrat','expression_besoin'));

CREATE TABLE bon_de_commande_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_de_commande_id uuid NOT NULL REFERENCES bons_de_commande(id) ON DELETE CASCADE,
  reference_id text NOT NULL,
  reference_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bon_de_commande_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_bon_de_commande_references ON bon_de_commande_references FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('aaf','caf','de','dp','administrateur','admin','superadmin')))
);
CREATE POLICY write_bon_de_commande_references ON bon_de_commande_references FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('aaf','caf','admin','superadmin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE bon_de_commande_references TO anon, authenticated, service_role;
