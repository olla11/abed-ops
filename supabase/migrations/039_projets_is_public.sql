ALTER TABLE projets_internes ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
