-- Migration 014 : deux taux horaires + paiements prestataires

-- 1. Insérer les deux taux (insert ou ne rien faire si déjà présent)
INSERT INTO parametres (cle, valeur)
VALUES
  ('taux_horaire_direct_fcfa',  '1500'),
  ('taux_horaire_credit_fcfa',  '1500')
ON CONFLICT (cle) DO NOTHING;

-- 2. Colonnes paiement sur soumissions
ALTER TABLE soumissions
  ADD COLUMN IF NOT EXISTS paye       boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS paye_le    timestamptz,
  ADD COLUMN IF NOT EXISTS paye_par   uuid REFERENCES profiles(id);

-- 3. Table paiements_prestataires (versements crédit partiels ou totaux)
CREATE TABLE IF NOT EXISTS paiements_prestataires (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prestataire_id uuid NOT NULL REFERENCES profiles(id),
  montant        numeric(12,2) NOT NULL,
  heures_payees  numeric(8,2),
  note           text,
  caf_id         uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE paiements_prestataires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prestataire voit ses paiements"
  ON paiements_prestataires FOR SELECT
  USING (
    prestataire_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('caf','admin','de','administrateur'))
  );

CREATE POLICY "caf insere paiements"
  ON paiements_prestataires FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('caf','admin'))
  );
