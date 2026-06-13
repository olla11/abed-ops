ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS matricule text,
  ADD COLUMN IF NOT EXISTS date_debut_contrat date,
  ADD COLUMN IF NOT EXISTS direction text;
