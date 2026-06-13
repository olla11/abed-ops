CREATE TABLE IF NOT EXISTS contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type_contrat text NOT NULL,
  poste text,
  direction text,
  date_debut date NOT NULL,
  date_fin date,
  statut text NOT NULL DEFAULT 'actif',
  salaire_brut numeric(12,2),
  observations text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE contrats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contrats_rh" ON contrats USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh','admin','de'))
  OR profile_id = auth.uid()
);
CREATE INDEX IF NOT EXISTS contrats_profile_id_idx ON contrats(profile_id);
CREATE INDEX IF NOT EXISTS contrats_statut_idx ON contrats(statut);
CREATE INDEX IF NOT EXISTS contrats_date_fin_idx ON contrats(date_fin);
