-- La table tdrs a RLS activé (migration_049_tdr.sql) mais aucune policy
-- DELETE n'avait été créée : le DELETE de l'API (route /api/tdrs/[id])
-- s'exécutait donc avec le token de l'utilisateur, RLS filtrait silencieusement
-- toutes les lignes (0 ligne supprimée, réponse "succès" quand même), et la
-- page se comportait comme si la suppression avait fonctionné alors que le
-- TDR restait en base. Cette policy autorise l'initiateur à supprimer son
-- propre TDR tant qu'il est en brouillon, ce qui correspond exactement à la
-- vérification déjà faite côté serveur dans la route DELETE.
CREATE POLICY "tdrs_delete" ON tdrs FOR DELETE TO authenticated USING (
  initiateur_id = auth.uid() AND statut = 'brouillon'
);
