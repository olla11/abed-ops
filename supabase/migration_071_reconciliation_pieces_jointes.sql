-- Migration 071 : pièces jointes optionnelles sur la réconciliation de mission

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS reconciliation_pieces_jointes jsonb DEFAULT '[]'::jsonb;
