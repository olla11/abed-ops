-- Nécessaire pour prévisualiser le PDF de l'appel de fonds pendant qu'il est
-- encore à l'état 'brouillon', avant de créer la demande_signature (qui elle
-- seule portait fichier_url jusqu'ici).
ALTER TABLE appels_de_fonds ADD COLUMN fichier_url text;
