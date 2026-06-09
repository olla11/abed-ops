-- Champs personnalisés pour le formulaire de demande de paiement
CREATE TABLE IF NOT EXISTS champs_demande (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  type text NOT NULL DEFAULT 'text', -- text | textarea | select | number
  required boolean NOT NULL DEFAULT false,
  options jsonb DEFAULT '[]',        -- pour type=select : ["Option A","Option B"]
  ordre int NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE champs_demande ENABLE ROW LEVEL SECURITY;

CREATE POLICY "champs_demande_read" ON champs_demande
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "champs_demande_manage" ON champs_demande
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('caf', 'admin', 'administrateur')
  ));

GRANT SELECT ON champs_demande TO authenticated;
GRANT ALL ON champs_demande TO service_role;

-- Stocker les réponses aux champs personnalisés dans la demande
ALTER TABLE demandes_paiement
  ADD COLUMN IF NOT EXISTS champs_supplementaires jsonb DEFAULT '{}';
