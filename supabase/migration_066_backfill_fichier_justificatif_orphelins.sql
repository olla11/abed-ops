-- Les 4 demandes de paiement soumises avant le correctif du schéma de
-- validation (route POST /api/demandes-paiement) avaient bien un fichier
-- uploadé dans le stockage, mais son chemin n'était jamais enregistré sur
-- la ligne (Zod supprimait silencieusement fichier_justificatif_url, absent
-- du schéma). Les fichiers sont toujours présents dans storage.objects
-- (bucket "timesheets") — on les relie ici en retrouvant, pour chaque
-- demande, le fichier "<demandeur_id>/..._justificatif.*" le plus proche
-- (juste avant) sa date de création.
UPDATE demandes_paiement d
SET fichier_justificatif_url = f.name
FROM (
  SELECT DISTINCT ON (o.name)
    o.name,
    split_part(o.name, '/', 1)::uuid AS demandeur_id,
    o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'timesheets' AND o.name LIKE '%_justificatif.%'
) f
WHERE d.fichier_justificatif_url IS NULL
  AND f.demandeur_id = d.demandeur_id
  AND f.created_at <= d.created_at
  AND f.created_at > d.created_at - interval '10 seconds';
