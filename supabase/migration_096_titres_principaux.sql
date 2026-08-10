-- Migration 096 : gestion des titres uniques en doublon (DE, DP, CAF, RH,
-- AAF, Président CA, Secrétaire Général CA, Trésorier CA).
--
-- Le système accepte aujourd'hui que plusieurs comptes partagent un même
-- titre censé être unique. Ce n'est pas grave en soi, mais pour ces 8
-- titres précis, un doublon doit être signalé à admin/superadmin, qui
-- désigne un titulaire "principal" — c'est son nom qui doit apparaître
-- officiellement partout (circuits de signature, documents), même si
-- l'autre titulaire agit aussi pour le compte du rôle. Admin/superadmin
-- peut rebasculer le principal à tout moment ; les dossiers déjà en
-- attente de ce rôle sont alors automatiquement réattribués au nouveau
-- principal.

-- ── Table : qui est principal pour un titre donné ──────────────────────
CREATE TABLE IF NOT EXISTS public.titres_principaux (
  titre                 titre_poste PRIMARY KEY,
  profile_id_principal  uuid NOT NULL REFERENCES public.profiles(id),
  defini_par            uuid REFERENCES public.profiles(id),
  defini_le             timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.titres_principaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin lit titres_principaux" ON public.titres_principaux
  FOR SELECT
  USING (public."current_role"() = ANY (ARRAY['admin','superadmin']::user_role[]));

-- Écriture exclusivement via la RPC reassigner_principal_titre (SECURITY
-- DEFINER) — aucune policy INSERT/UPDATE/DELETE directe.

-- ── Détection : notifie admin/superadmin dès qu'un titre unique se
--    retrouve porté par 2+ comptes actifs, et désigne un principal par
--    défaut (le titulaire le plus ancien) s'il n'y en a pas déjà un valide.
CREATE OR REPLACE FUNCTION public.detecter_doublon_titre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  titres_uniques titre_poste[] := ARRAY[
    'directeur_executif','directeur_programmes','caf','rh','aaf',
    'president_ca','secretaire_general_ca','tresorier_ca'
  ]::titre_poste[];
  autres_actifs int;
  principal_actuel uuid;
  principal_valide boolean;
  noms text;
  nom_principal text;
BEGIN
  IF NEW.titre IS NULL OR NOT (NEW.titre = ANY(titres_uniques)) OR NEW.archived THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO autres_actifs
  FROM public.profiles WHERE titre = NEW.titre AND archived = false AND id <> NEW.id;

  IF autres_actifs = 0 THEN
    RETURN NEW; -- pas de doublon
  END IF;

  SELECT profile_id_principal INTO principal_actuel
  FROM public.titres_principaux WHERE titre = NEW.titre;

  principal_valide := principal_actuel IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = principal_actuel AND titre = NEW.titre AND archived = false
  );

  IF principal_valide THEN
    RETURN NEW; -- doublon déjà connu et résolu, rien de nouveau à signaler
  END IF;

  -- Désigne par défaut le titulaire le plus ancien, en attendant l'arbitrage.
  SELECT id INTO principal_actuel FROM public.profiles
    WHERE titre = NEW.titre AND archived = false
    ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.titres_principaux (titre, profile_id_principal, defini_le)
  VALUES (NEW.titre, principal_actuel, now())
  ON CONFLICT (titre) DO UPDATE SET profile_id_principal = excluded.profile_id_principal, defini_le = now();

  SELECT string_agg(prenoms || ' ' || nom, ', ') INTO noms
  FROM public.profiles WHERE titre = NEW.titre AND archived = false;

  SELECT prenoms || ' ' || nom INTO nom_principal FROM public.profiles WHERE id = principal_actuel;

  INSERT INTO public.notifications (user_id, titre, message, lien)
  SELECT p.id, 'Titre en double détecté',
    format('Le titre "%s" est porté par plusieurs comptes actifs (%s). %s a été désigné principal par défaut — changez-le si besoin dans Comptes.',
      NEW.titre::text, noms, nom_principal),
    '/admin/comptes'
  FROM public.profiles p WHERE p.role IN ('admin', 'superadmin') AND p.archived = false;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_detecter_doublon_titre ON public.profiles;
CREATE TRIGGER trg_detecter_doublon_titre
  AFTER INSERT OR UPDATE OF titre, archived ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.detecter_doublon_titre();

-- ── Réattribution : bascule le principal et réassigne les dossiers en
--    attente routés nommément à l'ancien principal (signatures TDR en
--    attente, contrats envoyés au signataire mais pas encore signés).
CREATE OR REPLACE FUNCTION public.reassigner_principal_titre(p_titre titre_poste, p_nouveau_principal uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acteur_role user_role;
  ancien_principal uuid;
  role_systeme text;
  demandes_en_attente uuid[];
BEGIN
  SELECT role INTO acteur_role FROM public.profiles WHERE id = auth.uid();
  IF acteur_role IS NULL OR acteur_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_nouveau_principal AND titre = p_titre AND archived = false
  ) THEN
    RAISE EXCEPTION 'Ce compte ne porte pas ce titre';
  END IF;

  SELECT profile_id_principal INTO ancien_principal
  FROM public.titres_principaux WHERE titre = p_titre;

  INSERT INTO public.titres_principaux (titre, profile_id_principal, defini_par, defini_le)
  VALUES (p_titre, p_nouveau_principal, auth.uid(), now())
  ON CONFLICT (titre) DO UPDATE
    SET profile_id_principal = excluded.profile_id_principal,
        defini_par = excluded.defini_par,
        defini_le = now();

  IF ancien_principal IS NULL OR ancien_principal = p_nouveau_principal THEN
    RETURN; -- rien à réattribuer
  END IF;

  role_systeme := CASE p_titre
    WHEN 'directeur_executif' THEN 'de'
    WHEN 'directeur_programmes' THEN 'dp'
    WHEN 'caf' THEN 'caf'
    WHEN 'rh' THEN 'rh'
    WHEN 'aaf' THEN 'aaf'
    ELSE 'administrateur'
  END;

  -- TDR : créneau de signature encore en attente pour ce rôle.
  UPDATE public.tdr_signataires
    SET profile_id = p_nouveau_principal
    WHERE profile_id = ancien_principal AND statut = 'en_attente' AND role = role_systeme;

  -- Contrats : envoyés au signataire, pas encore signés — capture d'abord
  -- les demandes de signature liées pour les réattribuer aussi.
  SELECT array_agg(demande_signature_id) INTO demandes_en_attente
  FROM public.contrats
  WHERE signataire_id = ancien_principal AND workflow_statut = 'envoye_signataire' AND demande_signature_id IS NOT NULL;

  UPDATE public.contrats
    SET signataire_id = p_nouveau_principal
    WHERE signataire_id = ancien_principal AND workflow_statut = 'envoye_signataire';

  IF demandes_en_attente IS NOT NULL THEN
    UPDATE public.signataires
      SET profile_id = p_nouveau_principal
      WHERE profile_id = ancien_principal AND signe = false AND refuse = false
        AND demande_id = ANY(demandes_en_attente);
  END IF;
END $$;
