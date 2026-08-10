-- Migration 085 : ferme une faille d'escalade de privilèges CRITIQUE dans
-- attribuer_role() — plus grave que celle corrigée sur attribuer_titre
-- (migration 084), car elle permettait d'atteindre superadmin, pas
-- seulement admin.
--
-- La fonction vérifiait bien que seul un admin pouvait accorder les rôles
-- 'admin', 'de' ou 'administrateur' — mais 'superadmin' était absent de
-- cette liste de protection, des deux côtés (rôle demandé ET rôle de la
-- cible). Et le contrôle d'accès en tête de fonction autorisait TOUT
-- appelant admin, RH **ou CAF** à l'exécuter.
--
-- Conséquence concrète : un compte CAF ou RH, en appelant directement
-- cette RPC (sans passer par aucun écran — /api/admin/assign-role, le
-- seul appelant côté app, est lui bien verrouillé au superadmin, mais la
-- RPC reste exposée telle quelle via l'API Supabase), pouvait promouvoir
-- N'IMPORTE QUEL compte — y compris le sien — au rôle superadmin, le
-- niveau le plus élevé de l'application.
--
-- Correctif :
--  - Seuls admin/superadmin peuvent désormais appeler cette fonction
--    (retrait de rh/caf, cohérent avec le fait que le seul point d'entrée
--    légitime, /api/admin/assign-role, est déjà réservé au superadmin).
--  - Le rôle superadmin — unique dans l'application — ne peut être
--    accordé, ni retiré à un compte qui l'a déjà, que par le superadmin
--    lui-même.

CREATE OR REPLACE FUNCTION public.attribuer_role(cible uuid, nouveau_role user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demandeur_role user_role;
  cible_role     user_role;
BEGIN
  SELECT role INTO demandeur_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO cible_role     FROM public.profiles WHERE id = cible;

  IF demandeur_role IS NULL OR demandeur_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Anti auto-escalade : personne ne modifie son propre rôle ici.
  IF cible = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre rôle';
  END IF;

  -- Le rôle superadmin est unique : seul le superadmin peut l'accorder,
  -- ou modifier le rôle d'un compte qui le porte déjà.
  IF (nouveau_role = 'superadmin' OR cible_role = 'superadmin') AND demandeur_role <> 'superadmin' THEN
    RAISE EXCEPTION 'Seul le superadmin peut attribuer ou modifier ce rôle';
  END IF;

  -- Seul un admin (ou le superadmin) peut accorder un rôle à hauts privilèges.
  IF nouveau_role IN ('admin', 'de', 'administrateur') AND demandeur_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Seul un administrateur peut attribuer ce rôle';
  END IF;

  -- Seul un admin (ou le superadmin) peut modifier un compte déjà à hauts privilèges.
  IF cible_role IN ('admin', 'de', 'administrateur') AND demandeur_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier ce compte';
  END IF;

  UPDATE public.profiles SET role = nouveau_role WHERE id = cible;
END $$;
