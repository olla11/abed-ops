-- Migration 051 : permet au signataire dont c'est le tour (responsable
-- technique / CAF / DE) de modifier le contenu des chapitres avant de
-- signer ou refuser — pas seulement à l'initiateur en brouillon.
--
-- Corrige aussi un accès trop large hérité de la migration 049 : le CAF
-- pouvait modifier n'importe quel TDR à tout moment (pas seulement à sa
-- propre étape de validation, ni seulement à la clôture). Désormais le CAF
-- ne peut modifier que : (a) pendant sa propre étape de validation, ou
-- (b) une fois le TDR actif, pour la clôture. Vérifié en production par
-- simulation de auth.uid() : un CAF ne peut plus éditer un TDR encore en
-- validation technique (hors de son tour), mais peut toujours éditer à
-- son tour et à la clôture.

DROP POLICY IF EXISTS "tdrs_update" ON tdrs;
CREATE POLICY "tdrs_update" ON tdrs FOR UPDATE TO authenticated USING (
  initiateur_id = auth.uid()
  OR EXISTS (SELECT 1 FROM tdr_collaborateurs c WHERE c.tdr_id = id AND c.profile_id = auth.uid() AND c.permission = 'revision')
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  OR (statut = 'actif' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'caf'))
  OR EXISTS (
    SELECT 1 FROM tdr_signataires s
    WHERE s.tdr_id = tdrs.id AND s.profile_id = auth.uid()
      AND (
        (statut = 'en_validation_technique' AND s.role = 'responsable_technique')
        OR (statut = 'en_validation_caf' AND s.role = 'caf')
        OR (statut = 'en_autorisation_de' AND s.role = 'de')
      )
  )
);
