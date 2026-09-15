-- Ordre d'affichage réordonnable par glisser-déposer dans le Hub — espaces
-- et projets. NULL = pas encore réordonné manuellement (tri par défaut sur
-- created_at côté application), rempli séquentiellement dès le premier
-- glisser-déposer.
ALTER TABLE espaces ADD COLUMN ordre integer;
ALTER TABLE projets_internes ADD COLUMN ordre integer;
