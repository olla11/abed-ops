-- Permet au soumissionnaire de corriger ou supprimer un rapport d'allocation
-- (ou un timesheet/soumission) déjà soumis, même s'il a déjà avancé dans le
-- circuit (chez le responsable, l'AAF, la CAF ou le DE) — sans réinitialiser
-- son statut. corrige_le sert à afficher un bandeau "mis à jour" chez qui le
-- détient actuellement tant que personne n'a encore agi dessus depuis.
ALTER TABLE rapports_allocations ADD COLUMN IF NOT EXISTS corrige_le timestamptz;
ALTER TABLE soumissions ADD COLUMN IF NOT EXISTS corrige_le timestamptz;
