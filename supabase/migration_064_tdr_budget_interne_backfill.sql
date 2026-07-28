-- Nouveau chapitre TDR "Budget prévisionnel interne" (avant "Budget
-- prévisionnel détaillé"). L'ordre d'affichage est toujours recalculé côté
-- application à partir de CHAPITRE_CLES (src/lib/tdr.ts) — seule la
-- présence de l'objet dans le tableau JSON compte ici, pas sa position.
-- Sans ce backfill, chapitresValides() rejetterait toute sauvegarde/
-- soumission/clôture des TDR déjà créés (nombre de chapitres attendu passé
-- de 8 à 9).
UPDATE tdrs
SET chapitres = chapitres || jsonb_build_array(
  jsonb_build_object(
    'cle', 'budget_interne',
    'titre', 'Budget prévisionnel interne',
    'type', 'tableau',
    'texte', '',
    'tableau', jsonb_build_object(
      'colonnes', jsonb_build_array('Désignation', 'Unité', 'Qté', 'Coût unitaire (FCFA)', 'Coût total (FCFA)'),
      'lignes', '[]'::jsonb
    )
  )
)
WHERE NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(chapitres) elem WHERE elem->>'cle' = 'budget_interne'
);
