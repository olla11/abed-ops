-- Migration 050 : ancre les commentaires TDR à une sélection de texte
-- précise (comme un commentaire Word/Google Docs), au lieu d'un simple
-- fil de discussion global par TDR.

ALTER TABLE tdr_commentaires ADD COLUMN IF NOT EXISTS chapitre_cle text;
ALTER TABLE tdr_commentaires ADD COLUMN IF NOT EXISTS mark_id text;
ALTER TABLE tdr_commentaires ADD COLUMN IF NOT EXISTS texte_cite text;

CREATE INDEX IF NOT EXISTS idx_tdr_commentaires_mark ON tdr_commentaires(tdr_id, chapitre_cle, mark_id);

NOTIFY pgrst, 'reload schema';
