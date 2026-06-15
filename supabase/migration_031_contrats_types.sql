-- Add new columns to contrats table for document categories, articles, comments
ALTER TABLE contrats
  ADD COLUMN IF NOT EXISTS categorie_document TEXT DEFAULT 'Contrat',
  ADD COLUMN IF NOT EXISTS contrat_parent_id UUID REFERENCES contrats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS objet TEXT,
  ADD COLUMN IF NOT EXISTS articles JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS commentaires_employe TEXT,
  ADD COLUMN IF NOT EXISTS commentaires_rh TEXT;

-- Index for avenant lookup
CREATE INDEX IF NOT EXISTS idx_contrats_parent ON contrats(contrat_parent_id);
