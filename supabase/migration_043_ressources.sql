-- Migration 043 : onglet "Ressources" (guides, rapports, liens usuels) visible par tous,
-- gérable par RH/Admin sans avoir besoin d'un déploiement de code.

CREATE TABLE IF NOT EXISTS ressources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie text NOT NULL CHECK (categorie IN ('guide', 'rapport', 'lien_usuel')),
  titre text NOT NULL,
  url text NOT NULL,
  description text,
  ordre int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ressources_categorie_idx ON ressources(categorie, ordre);

ALTER TABLE ressources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ressources_select_all" ON ressources FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ressources_insert_rh_admin" ON ressources FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh', 'admin'))
);
CREATE POLICY "ressources_update_rh_admin" ON ressources FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh', 'admin'))
);
CREATE POLICY "ressources_delete_rh_admin" ON ressources FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh', 'admin'))
);
