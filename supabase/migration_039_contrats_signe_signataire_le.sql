ALTER TABLE contrats ADD COLUMN IF NOT EXISTS signe_signataire_le TIMESTAMPTZ;
NOTIFY pgrst, 'reload schema';
