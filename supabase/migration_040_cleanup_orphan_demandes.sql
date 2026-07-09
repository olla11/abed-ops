-- Nettoyage : demandes_signature orphelines créées par l'ancien flux d'envoi de contrat
-- au signataire (avant le correctif qui a supprimé ce circuit). Chaque nouvel essai de
-- "Envoyer au signataire" créait une nouvelle demande sans jamais réussir à la lier au
-- contrat, d'où des doublons visibles dans /signatures > "À signer".
--
-- 1) Exécutez d'abord ce SELECT pour vérifier ce qui sera supprimé.
SELECT id, titre, description, createur_id, statut, created_at
FROM demandes_signature
WHERE fichier_url IS NULL
  AND statut = 'en_attente'
  AND id NOT IN (
    SELECT demande_signature_id FROM contrats WHERE demande_signature_id IS NOT NULL
  );

-- 2) Si la liste ci-dessus correspond bien aux doublons de contrats (titres du type
--    "Contrat ... — Nom Prénom"), décommentez et exécutez la suppression ci-dessous.
--    La suppression en cascade retire aussi les lignes "signataires" associées.
-- DELETE FROM demandes_signature
-- WHERE fichier_url IS NULL
--   AND statut = 'en_attente'
--   AND id NOT IN (
--     SELECT demande_signature_id FROM contrats WHERE demande_signature_id IS NOT NULL
--   );
