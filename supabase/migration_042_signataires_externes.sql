-- Migration 042 : permet d'inviter des signataires externes (sans compte) par email
-- sur les demandes de signature génériques (demandes_signature / signataires).

ALTER TABLE signataires ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE signataires ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE signataires ADD COLUMN IF NOT EXISTS nom_externe text;

-- Un signataire est soit un profil interne (profile_id), soit un invité externe (email) — jamais les deux vides
ALTER TABLE signataires ADD CONSTRAINT signataires_profile_or_email CHECK (profile_id IS NOT NULL OR email IS NOT NULL);

-- Empêche d'inviter deux fois le même email sur la même demande
CREATE UNIQUE INDEX IF NOT EXISTS signataires_demande_email_uniq ON signataires(demande_id, email) WHERE email IS NOT NULL;
