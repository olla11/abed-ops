-- Migration 084 : ferme une faille d'escalade de privilèges dans
-- attribuer_titre().
--
-- La fonction acceptait un 4e paramètre optionnel `nouveau_role` qui,
-- s'il était fourni, écrasait directement profiles.role avec N'IMPORTE
-- QUELLE valeur (y compris 'admin' ou 'superadmin'), en contournant
-- entièrement la correspondance titre → accès normalement utilisée.
-- Aucun appelant de l'application ne passait ce paramètre (l'écran
-- GestionTitres n'en avait pas besoin), mais la fonction restait
-- appelable directement (RPC Postgres exposé au client) par tout compte
-- dont le rôle était admin, RH **ou CAF** — un compte CAF ou RH pouvait
-- donc s'auto-promouvoir (ou promouvoir n'importe qui) superadmin sans
-- passer par aucun écran.
--
-- Correctif : suppression du paramètre `nouveau_role` (la correspondance
-- titre → accès, bornée et ne produisant jamais 'admin'/'superadmin',
-- reste seule responsable du niveau d'accès) + restriction des appelants
-- à admin/RH (retrait de CAF, cohérent avec le retrait de son accès à
-- /admin/titres).

DROP FUNCTION IF EXISTS public.attribuer_titre(uuid, titre_poste, type_emploi, user_role);

CREATE OR REPLACE FUNCTION public.attribuer_titre(
  cible uuid,
  nouveau_titre titre_poste,
  nouveau_type type_emploi DEFAULT NULL::type_emploi
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demandeur_role user_role;
  access user_role;
BEGIN
  SELECT role INTO demandeur_role FROM public.profiles WHERE id = auth.uid();
  IF demandeur_role NOT IN ('admin', 'rh') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  access := CASE nouveau_titre
    WHEN 'directeur_executif'        THEN 'de'
    WHEN 'directeur_programmes'      THEN 'dp'
    WHEN 'caf'                       THEN 'caf'
    WHEN 'rh'                        THEN 'rh'
    WHEN 'aaf'                       THEN 'aaf'
    WHEN 'directeur_principal'       THEN 'manager'
    WHEN 'programme_lead'            THEN 'manager'
    WHEN 'charge_projet'             THEN 'manager'
    WHEN 'responsable_communication' THEN 'manager'
    WHEN 'president_ca'              THEN 'administrateur'
    WHEN 'secretaire_general_ca'     THEN 'administrateur'
    WHEN 'tresorier_ca'              THEN 'administrateur'
    ELSE 'missionnaire'
  END::user_role;

  UPDATE public.profiles
    SET titre       = nouveau_titre,
        type_emploi = COALESCE(nouveau_type, type_emploi),
        role        = access
  WHERE id = cible;
END $$;
