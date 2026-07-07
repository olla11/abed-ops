-- Workflow de signature des contrats
ALTER TABLE contrats
  ADD COLUMN IF NOT EXISTS workflow_statut TEXT DEFAULT 'envoye_employe',
  ADD COLUMN IF NOT EXISTS signe_employe_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signataire_id UUID REFERENCES profiles(id);

-- Mettre à jour les contrats existants
UPDATE contrats SET workflow_statut = 'envoye_employe' WHERE workflow_statut IS NULL;

NOTIFY pgrst, 'reload schema';
