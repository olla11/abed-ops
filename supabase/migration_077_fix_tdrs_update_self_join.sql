-- Bug de longue date dans la policy tdrs_update (introduit en migration_049,
-- reconduit tel quel en 051 et 069) : les sous-requêtes EXISTS comparaient
-- `c.tdr_id = id` / `s.tdr_id = id` avec un `id` NON qualifié. Comme
-- tdr_collaborateurs et tdr_signataires ont elles-mêmes une colonne `id`
-- (leur propre clé primaire), Postgres résout l'`id` non qualifié dans le
-- scope le plus interne — donc `c.id`/`s.id` — et NON `tdrs.id` comme
-- voulu. Résultat : `c.tdr_id = c.id` compare deux UUID sans rapport, qui
-- ne coïncident (quasiment) jamais → la branche collaborateur/signataire de
-- la policy ne matchait donc jamais personne. Seuls l'initiateur et les
-- rôles admin/caf pouvaient réellement modifier un TDR ; tout autre
-- signataire (ex. responsable technique) voyait son UPDATE bloqué par la
-- RLS, ce qui faisait échouer le SELECT de retour avec l'erreur PostgREST
-- "Cannot coerce the result to a single JSON object" (0 ligne renvoyée).
DROP POLICY IF EXISTS "tdrs_update" ON tdrs;
CREATE POLICY "tdrs_update" ON tdrs FOR UPDATE TO authenticated USING (
  initiateur_id = auth.uid()
  OR EXISTS (SELECT 1 FROM tdr_collaborateurs c WHERE c.tdr_id = tdrs.id AND c.profile_id = auth.uid() AND c.permission = 'revision')
  OR EXISTS (SELECT 1 FROM tdr_signataires s WHERE s.tdr_id = tdrs.id AND s.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'caf'))
);
