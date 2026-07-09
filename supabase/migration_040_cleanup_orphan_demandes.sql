-- Nettoyage : demandes_signature orphelines créées par l'ancien flux d'envoi de contrat
-- au signataire (avant le correctif qui a supprimé ce circuit). Chaque nouvel essai de
-- "Envoyer au signataire" créait une nouvelle demande, d'où des doublons visibles dans
-- /signatures > "À signer" (ex. "Contrat Prestataire direct — Olla BOOS" en double).
--
-- Note : la colonne contrats.demande_signature_id n'existe pas dans cette base (la
-- migration qui devait la créer n'a jamais été exécutée), donc TOUTES les demandes
-- créées par l'ancien flux d'envoi au signataire sont orphelines par définition.
--
-- 1) Exécutez d'abord ce SELECT pour vérifier ce qui sera supprimé.
SELECT id, titre, description, createur_id, statut, created_at
FROM demandes_signature
WHERE fichier_url IS NULL
  AND statut = 'en_attente'
  AND titre ~ '^(Contrat|Convention|Avenant|Offre de stage) .* — ';

-- 2) Si la liste ci-dessus correspond bien aux doublons de contrats, décommentez et
--    exécutez la suppression ci-dessous. La suppression en cascade retire aussi les
--    lignes "signataires" associées.
-- DELETE FROM demandes_signature
-- WHERE fichier_url IS NULL
--   AND statut = 'en_attente'
--   AND titre ~ '^(Contrat|Convention|Avenant|Offre de stage) .* — ';
