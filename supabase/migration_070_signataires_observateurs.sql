-- Permet d'ajouter, sur une demande de signature, des personnes qui ne
-- signent pas mais reçoivent le document final par email (avec le PDF
-- signé en pièce jointe) une fois que tous les vrais signataires ont signé.
ALTER TABLE signataires ADD COLUMN IF NOT EXISTS est_observateur boolean NOT NULL DEFAULT false;
