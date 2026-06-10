-- =====================================================================
-- Migration 019 : correctifs de sécurité
-- =====================================================================
-- 1. Empêcher l'auto-escalade de privilèges via l'API PostgREST :
--    la policy RLS "user update own profile" est row-level et autorise
--    donc la modification de TOUTES les colonnes de sa propre ligne,
--    y compris `role`. La clé anon étant publique, n'importe quel compte
--    pouvait se promouvoir `admin` par un simple PATCH /rest/v1/profiles.
--
--    Correctif : retirer le privilège UPDATE au niveau table au rôle
--    `authenticated`, puis ne ré-accorder QUE les colonnes éditables par
--    l'utilisateur lui-même. `role`, `email`, `id`, `manager_id`,
--    `created_at` deviennent non modifiables par un client.
--    Le RPC `attribuer_role` (SECURITY DEFINER) et le `service_role`
--    conservent le droit de modifier `role`.
-- =====================================================================

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;

-- Colonnes que l'utilisateur peut légitimement modifier sur son propre profil
-- (cf. /api/profile/update). Toute autre colonne (role, email, manager_id…)
-- ne peut être changée que par le service_role ou un RPC SECURITY DEFINER.
GRANT UPDATE (
  nom, prenoms, civilite, telephone, ifu, fonction,
  adresse, date_naissance, lieu_naissance, nationalite
) ON public.profiles TO authenticated;

-- =====================================================================
-- 2. Durcir le RPC d'attribution de rôle :
--    - interdiction de modifier son propre rôle (anti auto-escalade) ;
--    - seul un `admin` peut accorder/retirer les rôles à hauts privilèges
--      (admin, de, administrateur) ;
--    - rh/caf ne peuvent pas toucher un compte déjà à hauts privilèges.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.attribuer_role(
  cible uuid,
  nouveau_role user_role
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  demandeur_role user_role;
  cible_role     user_role;
BEGIN
  SELECT role INTO demandeur_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO cible_role     FROM public.profiles WHERE id = cible;

  IF demandeur_role IS NULL OR demandeur_role NOT IN ('admin','rh','caf') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Anti auto-escalade : personne ne modifie son propre rôle ici.
  IF cible = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre rôle';
  END IF;

  -- Seul un admin peut accorder un rôle à hauts privilèges.
  IF nouveau_role IN ('admin','de','administrateur') AND demandeur_role <> 'admin' THEN
    RAISE EXCEPTION 'Seul un administrateur peut attribuer ce rôle';
  END IF;

  -- Seul un admin peut modifier un compte déjà à hauts privilèges.
  IF cible_role IN ('admin','de','administrateur') AND demandeur_role <> 'admin' THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier ce compte';
  END IF;

  UPDATE public.profiles SET role = nouveau_role WHERE id = cible;
END $$;
