ALTER TABLE contrats ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE contrats ADD COLUMN IF NOT EXISTS motif_resiliation text;
ALTER TABLE contrats ADD COLUMN IF NOT EXISTS demande_signature_id uuid REFERENCES demandes_signature(id) ON DELETE SET NULL;
-- Create sequence for contract numbers
CREATE SEQUENCE IF NOT EXISTS contrats_numero_seq START 1;
NOTIFY pgrst, 'reload schema';
