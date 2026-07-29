-- Numérotation officielle des demandes de paiement : DDP-{année}-{séquence sur 3 chiffres}
-- (ex. DDP-2026-001). Attribué à la création, séquentiel par année civile.

ALTER TABLE demandes_paiement ADD COLUMN IF NOT EXISTS numero text UNIQUE;

-- Backfill des demandes déjà existantes, numérotées dans l'ordre de création, par année.
WITH a_numeroter AS (
  SELECT id, created_at,
    row_number() OVER (PARTITION BY extract(year FROM created_at) ORDER BY created_at) AS rang
  FROM demandes_paiement
  WHERE numero IS NULL
)
UPDATE demandes_paiement d
SET numero = 'DDP-' || extract(year FROM a.created_at) || '-' || lpad(a.rang::text, 3, '0')
FROM a_numeroter a
WHERE d.id = a.id;
