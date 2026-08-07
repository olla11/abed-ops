-- Un commentaire de TDR ne pouvait jusqu'ici qu'être créé, jamais modifié ni
-- supprimé (aucune policy UPDATE/DELETE n'existait sur tdr_commentaires).
-- Réservé au propre auteur du commentaire. Les réponses (parent_id) sont
-- supprimées en cascade côté base (contrainte FK déjà en ON DELETE CASCADE).
CREATE POLICY "tdr_commentaires_update" ON tdr_commentaires FOR UPDATE TO authenticated
USING (auteur_id = auth.uid())
WITH CHECK (auteur_id = auth.uid());

CREATE POLICY "tdr_commentaires_delete" ON tdr_commentaires FOR DELETE TO authenticated
USING (auteur_id = auth.uid());

GRANT UPDATE, DELETE ON public.tdr_commentaires TO authenticated;
