-- Migration 009 : réconciliation non-partenaire avec validation CAF

-- Ajouter les colonnes nécessaires à la table missions
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS mode_financement text CHECK (mode_financement IN ('credit', 'avance', 'totalite_avant')),
  ADD COLUMN IF NOT EXISTS reconciliation_commentaire text;

-- Le statut 'reconciliation_caf' est géré applicativement (varchar sans enum)
-- On met juste à jour la contrainte si elle existe
DO $$
BEGIN
  -- Vérifier si la contrainte existe avant de la modifier
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'missions_status_check'
    AND conrelid = 'missions'::regclass
  ) THEN
    ALTER TABLE missions DROP CONSTRAINT missions_status_check;
    ALTER TABLE missions ADD CONSTRAINT missions_status_check CHECK (
      status IN (
        'brouillon','soumis','signe','en_mission',
        'reconciliation','reconciliation_caf',
        'paiement_attente','cloture','rejete'
      )
    );
  END IF;
END $$;
