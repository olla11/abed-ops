-- Le Hub est pensé comme collaboratif au niveau de l'espace : n'importe quel
-- membre (pas seulement le créateur) doit pouvoir renommer/modifier un
-- projet de l'espace, et inviter d'autres membres — c'était jusqu'ici
-- restreint au seul créateur, d'où le "new row violates row-level security
-- policy" rencontré par un membre non-créateur en renommant un projet.
DROP POLICY projets_update ON projets_internes;
CREATE POLICY projets_update ON projets_internes FOR UPDATE USING (
  auth.uid() = created_by OR (espace_id IS NOT NULL AND is_espace_member(espace_id))
) WITH CHECK (
  auth.uid() = created_by OR (espace_id IS NOT NULL AND is_espace_member(espace_id))
);

DROP POLICY espace_membres_insert ON espace_membres;
CREATE POLICY espace_membres_insert ON espace_membres FOR INSERT WITH CHECK (
  invited_by = auth.uid() AND is_espace_member(espace_id)
);
