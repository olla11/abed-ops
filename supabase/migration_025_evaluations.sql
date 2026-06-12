CREATE TABLE evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid REFERENCES contrats(id) ON DELETE SET NULL,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evaluateur_id uuid REFERENCES profiles(id),

  -- Section I
  poste text,
  direction text,
  superieur_hierarchique text,
  superieur_fonctionnel text,
  responsable_departement text,
  nom_evaluateur text,
  description_taches text,

  -- Section II - grille (JSON: {"c1_1": 3, "c1_2": 4, ...})
  grille_notes jsonb DEFAULT '{}',
  score_moyen numeric(3,2),

  -- Section III
  qualites text,
  points_amelioration text,

  -- Section IV
  actions_exceptionnelles text,

  -- Section V
  evaluation_generale text,

  -- Section VI (évaluateur)
  commentaire_evaluateur text,
  signature_evaluateur text,
  date_evaluateur date,

  -- Section VII (évalué)
  commentaire_evalue text,
  signature_evalue text,
  date_evalue date,

  -- Section VIII (responsable département)
  avis_responsable text,
  commentaire_responsable text,
  signature_responsable text,
  date_responsable date,

  -- Section X (décisions)
  decision_evaluateur jsonb DEFAULT '{}',
  decision_rh jsonb DEFAULT '{}',
  decision_de jsonb DEFAULT '{}',

  -- Workflow
  statut text NOT NULL DEFAULT 'en_attente',

  declenchee_le timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX ON evaluations(profile_id);
CREATE INDEX ON evaluations(statut);
CREATE INDEX ON evaluations(contrat_id);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluation_visibility" ON evaluations USING (
  profile_id = auth.uid() OR
  evaluateur_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh','admin','de'))
);
