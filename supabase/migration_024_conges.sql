CREATE TABLE IF NOT EXISTS types_conge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  jours_annuels integer NOT NULL DEFAULT 30,
  actif boolean DEFAULT true
);
INSERT INTO types_conge (nom, jours_annuels) VALUES
  ('Congé annuel', 30),
  ('Congé maladie', 15),
  ('Congé maternité', 98),
  ('Congé paternité', 3),
  ('Congé sans solde', 0)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS soldes_conges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type_conge_id uuid NOT NULL REFERENCES types_conge(id),
  annee integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  jours_acquis numeric(5,1) DEFAULT 30,
  jours_pris numeric(5,1) DEFAULT 0,
  UNIQUE(profile_id, type_conge_id, annee)
);
ALTER TABLE soldes_conges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "soldes_own" ON soldes_conges USING (
  profile_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh','admin'))
);

CREATE TABLE IF NOT EXISTS conges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type_conge_id uuid REFERENCES types_conge(id),
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  nb_jours numeric(5,1),
  motif text,
  statut text NOT NULL DEFAULT 'en_attente',
  valideur_n1_id uuid REFERENCES profiles(id),
  valideur_final_id uuid REFERENCES profiles(id),
  commentaire_valideur text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE conges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conges_visibility" ON conges USING (
  profile_id = auth.uid() OR
  valideur_n1_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh','admin'))
);
CREATE INDEX IF NOT EXISTS conges_profile_id_idx ON conges(profile_id);
CREATE INDEX IF NOT EXISTS conges_statut_idx ON conges(statut);
