-- Cohérence avec projets_update (migration_114) : un membre de l'espace
-- (pas seulement son créateur) doit pouvoir le modifier — renommer,
-- recolorer, et surtout réordonner par glisser-déposer, une action
-- collaborative par nature.
DROP POLICY espaces_update ON espaces;
CREATE POLICY espaces_update ON espaces FOR UPDATE USING (
  created_by = auth.uid() OR is_espace_member(id)
) WITH CHECK (
  created_by = auth.uid() OR is_espace_member(id)
);
