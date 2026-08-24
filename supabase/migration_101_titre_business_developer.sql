-- Migration 101 : ajoute le titre/poste "Business Developer".
-- Niveau d'accès : 'manager', cohérent avec les autres titres de même
-- rang (Directeur principal, Programme Lead, Chargé de Projet,
-- Responsable communication, Représentant Pays). Pas d'ancienneté requise
-- (barème de rémunération) — même traitement que Directeur principal.

ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'business_developer';

CREATE OR REPLACE FUNCTION public.attribuer_titre(cible uuid, nouveau_titre titre_poste, nouveau_type type_emploi DEFAULT NULL::type_emploi, nouvelle_seniorite seniorite_niveau DEFAULT NULL::seniorite_niveau)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  demandeur_role user_role;
  access user_role;
  seniorite_appliquee seniorite_niveau;
  titre_final titre_poste;
  type_final type_emploi;
BEGIN
  SELECT role INTO demandeur_role FROM public.profiles WHERE id = auth.uid();
  IF demandeur_role NOT IN ('admin', 'caf', 'superadmin') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF demandeur_role = 'caf' THEN
    SELECT titre, type_emploi INTO titre_final, type_final
    FROM public.profiles WHERE id = cible;
    IF titre_final IS NULL THEN
      RAISE EXCEPTION 'Compte cible sans titre — attribution réservée à admin/superadmin';
    END IF;
  ELSE
    titre_final := nouveau_titre;
    type_final  := COALESCE(nouveau_type, (SELECT type_emploi FROM public.profiles WHERE id = cible));
  END IF;

  access := CASE titre_final
    WHEN 'directeur_executif'        THEN 'de'
    WHEN 'directeur_programmes'      THEN 'dp'
    WHEN 'caf'                       THEN 'caf'
    WHEN 'rh'                        THEN 'rh'
    WHEN 'aaf'                       THEN 'aaf'
    WHEN 'directeur_principal'       THEN 'manager'
    WHEN 'programme_lead'            THEN 'manager'
    WHEN 'charge_projet'             THEN 'manager'
    WHEN 'responsable_communication' THEN 'manager'
    WHEN 'representant_pays'         THEN 'manager'
    WHEN 'business_developer'        THEN 'manager'
    WHEN 'president_ca'              THEN 'administrateur'
    WHEN 'secretaire_general_ca'     THEN 'administrateur'
    WHEN 'tresorier_ca'              THEN 'administrateur'
    ELSE 'missionnaire'
  END::user_role;

  IF titre_final IN ('representant_pays', 'programme_lead', 'responsable_communication', 'charge_projet') THEN
    seniorite_appliquee := nouvelle_seniorite;
  ELSE
    seniorite_appliquee := NULL;
  END IF;

  UPDATE public.profiles
    SET titre       = titre_final,
        type_emploi = type_final,
        role        = access,
        seniorite   = seniorite_appliquee
  WHERE id = cible;
END $function$;
