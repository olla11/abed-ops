-- Commentaires de la CAF sur l'exécution financière, par trimestre (1-4) ou
-- au niveau annuel (trimestre = 0) — repris dans le rapport PDF détaillé
-- généré depuis la vue Exécution financière. trimestre=0 plutôt que NULL
-- pour l'annuel : l'upsert PostgREST (onConflict) a besoin d'une contrainte
-- UNIQUE simple sur (annee, trimestre), qui ne peut pas fonctionner avec
-- NULL (NULL != NULL en unicité Postgres).
CREATE TABLE execution_financiere_commentaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annee int NOT NULL,
  trimestre int NOT NULL DEFAULT 0 CHECK (trimestre BETWEEN 0 AND 4),
  commentaire text NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (annee, trimestre)
);

ALTER TABLE execution_financiere_commentaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_execution_financiere_commentaires ON execution_financiere_commentaires FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('caf','aaf','de','dp','administrateur','admin','superadmin')))
);
CREATE POLICY write_execution_financiere_commentaires ON execution_financiere_commentaires FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin','superadmin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE execution_financiere_commentaires TO anon, authenticated, service_role;
