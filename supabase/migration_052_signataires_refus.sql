-- Migration 052 : permet à un signataire (interne ou externe) de refuser de
-- signer une demande de signature générique en indiquant obligatoirement un
-- motif. L'initiateur est notifié, corrige le document puis le renvoie
-- (réinitialise tous les signataires) via /api/signatures/[id]/renvoyer.

ALTER TABLE signataires ADD COLUMN IF NOT EXISTS refuse boolean NOT NULL DEFAULT false;
ALTER TABLE signataires ADD COLUMN IF NOT EXISTS refuse_le timestamptz;
ALTER TABLE signataires ADD COLUMN IF NOT EXISTS refuse_motif text;
