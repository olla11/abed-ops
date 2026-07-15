-- Migration 048 : ajoute deux titres "communication" (accès manager pour le
-- responsable, missionnaire par défaut pour l'assistant).
-- Note : les deux ALTER TYPE doivent être appliqués dans une transaction
-- séparée de la fonction qui les utilise (limitation Postgres sur les enums).

ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'responsable_communication';
ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'assistant_communication';

CREATE OR REPLACE FUNCTION public.attribuer_titre(cible uuid, nouveau_titre titre_poste, nouveau_type type_emploi DEFAULT NULL::type_emploi, nouveau_role user_role DEFAULT NULL::user_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  demandeur_role user_role;
  access user_role;
BEGIN
  SELECT role INTO demandeur_role FROM public.profiles WHERE id = auth.uid();
  IF demandeur_role NOT IN ('admin','rh','caf') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF nouveau_role IS NOT NULL THEN
    access := nouveau_role;
  ELSE
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
  END IF;
  UPDATE public.profiles
    SET titre       = nouveau_titre,
        type_emploi = COALESCE(nouveau_type, type_emploi),
        role        = access
  WHERE id = cible;
END $function$;

NOTIFY pgrst, 'reload schema';
