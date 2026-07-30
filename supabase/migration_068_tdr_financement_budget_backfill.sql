-- Nouveau chapitre TDR "Financement du Budget" (après "Budget prévisionnel
-- détaillé"). Colonnes fixes, imposées par l'application (voir
-- colonnesVerrouillees() dans src/lib/tdr.ts) : toute demande soumise doit
-- présenter la même structure (source de financement / pourcentage-montant /
-- titulaire du budget), donc l'entête n'est ni renommable ni ajoutable côté
-- éditeur — seule sa présence dans le tableau JSON compte ici.
-- Sans ce backfill, chapitresValides() rejetterait toute sauvegarde/
-- soumission/clôture des TDR déjà créés (nombre de chapitres attendu passé
-- de 9 à 10).
UPDATE tdrs
SET chapitres = chapitres || jsonb_build_array(
  jsonb_build_object(
    'cle', 'financement_budget',
    'titre', 'Financement du Budget',
    'type', 'tableau',
    'texte', '',
    'tableau', jsonb_build_object(
      'colonnes', jsonb_build_array('Source de financement: Budget', 'Pourcentage (Montant)', 'Titulaire du Budget'),
      'lignes', '[]'::jsonb
    )
  )
)
WHERE NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(chapitres) elem WHERE elem->>'cle' = 'financement_budget'
);
