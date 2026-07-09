-- Permet à l'employé et au signataire (DE/PCA) de renvoyer un contrat sans
-- signer, avec un motif obligatoire. commentaires_employe existait déjà et
-- sert aussi pour le motif de refus employé ; il manque l'équivalent côté
-- signataire.

ALTER TABLE contrats ADD COLUMN IF NOT EXISTS commentaires_signataire TEXT;

NOTIFY pgrst, 'reload schema';
