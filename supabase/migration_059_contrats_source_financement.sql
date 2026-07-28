-- Source de financement (bailleur) d'un contrat, pour le reporting de la
-- masse salariale par bailleur (Expertise France CLEE-2i, Prometiers,
-- ABED Directe, Réserve...).
ALTER TABLE contrats ADD COLUMN IF NOT EXISTS source_financement text;
