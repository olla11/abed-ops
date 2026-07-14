-- Migration 045 : ajoute la catégorie "publication" aux Ressources, et une
-- sous-catégorie libre (utilisée pour classer les rapports : annuel / projet / technique).

ALTER TABLE ressources DROP CONSTRAINT ressources_categorie_check;
ALTER TABLE ressources ADD CONSTRAINT ressources_categorie_check
  CHECK (categorie IN ('guide', 'rapport', 'lien_usuel', 'publication'));

ALTER TABLE ressources ADD COLUMN IF NOT EXISTS sous_categorie text;

NOTIFY pgrst, 'reload schema';
