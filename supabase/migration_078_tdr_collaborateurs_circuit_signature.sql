-- Tout le monde dans le circuit de signature d'un TDR (initiateur +
-- signataires : responsable technique, CAF, DE) doit pouvoir ajouter/retirer
-- des collaborateurs à tout moment, pas seulement l'initiateur.
--
-- Attention à la même classe de bug corrigée en migration_077 : dans une
-- sous-requête EXISTS, une colonne non qualifiée peut se résoudre sur la
-- table de la sous-requête plutôt que sur la table externe si les deux
-- portent une colonne du même nom. Ici tdr_signataires a elle-même une
-- colonne `tdr_id` — donc `s.tdr_id = tdr_id` non qualifié se résoudrait à
-- tort sur `s.tdr_id = s.tdr_id` (toujours vrai, faille de sécurité). On
-- qualifie donc explicitement `tdr_collaborateurs.tdr_id` partout.
DROP POLICY IF EXISTS "tdr_collaborateurs_insert" ON tdr_collaborateurs;
CREATE POLICY "tdr_collaborateurs_insert" ON tdr_collaborateurs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tdrs t WHERE t.id = tdr_collaborateurs.tdr_id AND t.initiateur_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tdr_signataires s WHERE s.tdr_id = tdr_collaborateurs.tdr_id AND s.profile_id = auth.uid())
);

DROP POLICY IF EXISTS "tdr_collaborateurs_delete" ON tdr_collaborateurs;
CREATE POLICY "tdr_collaborateurs_delete" ON tdr_collaborateurs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tdrs t WHERE t.id = tdr_collaborateurs.tdr_id AND t.initiateur_id = auth.uid())
  OR EXISTS (SELECT 1 FROM tdr_signataires s WHERE s.tdr_id = tdr_collaborateurs.tdr_id AND s.profile_id = auth.uid())
);
