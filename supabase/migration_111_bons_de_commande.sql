-- Bon de commande émis par l'AAF, envoyé en signature soit au DE (montant
-- < 3 000 000 FCFA) soit au PCA (montant >= 3 000 000 FCFA) — un seul
-- signataire selon le montant, via le système générique de signature
-- (demandes_signature/signataires), pas un circuit à étapes multiples comme
-- l'appel de fonds.
CREATE TABLE bons_de_commande (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  fournisseur_nom text NOT NULL,
  fournisseur_rccm text,
  fournisseur_ifu text,
  fournisseur_telephone text,
  objet text NOT NULL,
  date_livraison_souhaitee text,
  montant_total numeric(14,2) NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','circuit_signature','signe','rejete')),
  signataire_role text NOT NULL CHECK (signataire_role IN ('de','pca')),
  fichier_url text,
  demande_signature_id uuid REFERENCES demandes_signature(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bons_de_commande ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_bons_de_commande ON bons_de_commande FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('aaf','caf','de','dp','administrateur','admin','superadmin')))
);
CREATE POLICY write_bons_de_commande ON bons_de_commande FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('aaf','admin','superadmin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE bons_de_commande TO anon, authenticated, service_role;

CREATE TABLE bon_de_commande_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_de_commande_id uuid NOT NULL REFERENCES bons_de_commande(id) ON DELETE CASCADE,
  jour text,
  designation text NOT NULL,
  quantite numeric(10,2) NOT NULL,
  prix_unitaire numeric(14,2) NOT NULL,
  montant numeric(14,2) NOT NULL,
  ordre int NOT NULL DEFAULT 0
);

ALTER TABLE bon_de_commande_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_bon_de_commande_lignes ON bon_de_commande_lignes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('aaf','caf','de','dp','administrateur','admin','superadmin')))
);
CREATE POLICY write_bon_de_commande_lignes ON bon_de_commande_lignes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('aaf','admin','superadmin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE bon_de_commande_lignes TO anon, authenticated, service_role;
