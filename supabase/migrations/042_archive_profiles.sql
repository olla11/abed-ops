-- Migration 042: archivage des comptes (au lieu de suppression)
-- Permet de désactiver un compte sans perdre l'historique des actions

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

-- Index pour filtrer rapidement les actifs
CREATE INDEX IF NOT EXISTS idx_profiles_archived ON profiles(archived) WHERE archived = false;

-- Commentaire métier
COMMENT ON COLUMN profiles.archived IS 'Compte désactivé (démission, fin contrat) — historique conservé';
COMMENT ON COLUMN profiles.archived_reason IS 'Raison de l archivage : Démission, Fin de contrat, Mutation, etc.';
