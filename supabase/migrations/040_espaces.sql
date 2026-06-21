CREATE TABLE IF NOT EXISTS espaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  couleur text NOT NULL DEFAULT '#16a34a',
  icon text NOT NULL DEFAULT '📁',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projets_internes ADD COLUMN IF NOT EXISTS espace_id uuid REFERENCES espaces(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE espaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "espaces_select" ON espaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "espaces_insert" ON espaces FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "espaces_update" ON espaces FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "espaces_delete" ON espaces FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Service role access
GRANT ALL ON espaces TO service_role;
