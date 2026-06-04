-- Migration 012 : nouveaux titres CA + rôle administrateur + accès manuel

-- 1. Ajouter le rôle 'administrateur' à l'enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrateur';

-- 2. Ajouter les nouveaux titres CA à l'enum titre_poste
ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'president_ca';
ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'secretaire_general_ca';
ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'tresorier_ca';

-- 3. Remplacer attribuer_titre pour accepter un rôle explicite (optionnel)
--    Si nouveau_role est fourni → on l'utilise directement
--    Sinon → on déduit le rôle du titre (comportement historique)
CREATE OR REPLACE FUNCTION public.attribuer_titre(
  cible uuid,
  nouveau_titre titre_poste,
  nouveau_type type_emploi DEFAULT NULL,
  nouveau_role user_role DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  demandeur_role user_role;
  access user_role;
BEGIN
  SELECT role INTO demandeur_role FROM public.profiles WHERE id = auth.uid();
  IF demandeur_role NOT IN ('admin','rh','caf') THEN
    RAISE EXCEPTION 'Non autorisé : seuls Admin, RH et CAF attribuent les titres';
  END IF;

  -- Si un rôle est explicitement fourni, l'utiliser ; sinon déduire du titre
  IF nouveau_role IS NOT NULL THEN
    access := nouveau_role;
  ELSE
    access := CASE nouveau_titre
      WHEN 'directeur_executif'    THEN 'de'
      WHEN 'caf'                   THEN 'caf'
      WHEN 'rh'                    THEN 'rh'
      WHEN 'directeur_principal'   THEN 'manager'
      WHEN 'programme_lead'        THEN 'manager'
      WHEN 'charge_projet'         THEN 'manager'
      WHEN 'president_ca'          THEN 'administrateur'
      WHEN 'secretaire_general_ca' THEN 'administrateur'
      WHEN 'tresorier_ca'          THEN 'administrateur'
      ELSE 'missionnaire'
    END::user_role;
  END IF;

  UPDATE public.profiles
    SET titre       = nouveau_titre,
        type_emploi = COALESCE(nouveau_type, type_emploi),
        role        = access
  WHERE id = cible;
END $$;

-- 4. Fonction séparée pour changer uniquement le rôle (sans toucher au titre)
CREATE OR REPLACE FUNCTION public.attribuer_role(
  cible uuid,
  nouveau_role user_role
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  demandeur_role user_role;
BEGIN
  SELECT role INTO demandeur_role FROM public.profiles WHERE id = auth.uid();
  IF demandeur_role NOT IN ('admin','rh','caf') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  UPDATE public.profiles SET role = nouveau_role WHERE id = cible;
END $$;
