-- Migration 046 : corrige le contrôle d'accès des espaces/projets internes.
-- Avant cette migration, les policies SELECT sur espaces/espace_membres/
-- projets_internes/activites/commentaires_activites étaient toutes
-- `USING (true)` : n'importe quel utilisateur authentifié pouvait lire
-- n'importe quel espace, sa liste de membres, et ses projets — même sans
-- y avoir été invité. Idem pour l'écriture sur activites/commentaires,
-- ouverte à tous sans vérifier l'accès au projet parent.

CREATE OR REPLACE FUNCTION public.is_espace_member(p_espace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM espace_membres WHERE espace_id = p_espace_id AND profile_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_espace_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_projet(p_projet_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projets_internes p
    WHERE p.id = p_projet_id
    AND (
      -- Projet hors espace : visible s'il est public, créé par l'utilisateur,
      -- ou si l'utilisateur a une tâche qui lui est assignée dessus.
      (p.espace_id IS NULL AND (
        p.is_public = true
        OR p.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM activites a WHERE a.projet_id = p.id AND a.assignee_id = auth.uid())
      ))
      -- Projet rattaché à un espace : réservé aux membres de cet espace.
      OR (p.espace_id IS NOT NULL AND public.is_espace_member(p.espace_id))
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_access_projet(uuid) TO authenticated;

-- espaces : visible seulement par le créateur ou un membre invité
DROP POLICY IF EXISTS "espaces_select" ON espaces;
CREATE POLICY "espaces_select" ON espaces FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR public.is_espace_member(id)
);

-- espace_membres : la liste des membres n'est visible que par les membres eux-mêmes
DROP POLICY IF EXISTS "espace_membres_select" ON espace_membres;
CREATE POLICY "espace_membres_select" ON espace_membres FOR SELECT TO authenticated USING (
  public.is_espace_member(espace_id)
);

-- projets_internes : suit can_access_projet (public/créateur/assigné hors espace,
-- membre de l'espace sinon)
DROP POLICY IF EXISTS "projets_select" ON projets_internes;
CREATE POLICY "projets_select" ON projets_internes FOR SELECT TO authenticated USING (
  public.can_access_projet(id)
);

-- activites : lecture ET écriture réservées à qui a accès au projet parent
DROP POLICY IF EXISTS "activites_select" ON activites;
CREATE POLICY "activites_select" ON activites FOR SELECT TO authenticated USING (
  public.can_access_projet(projet_id)
);

DROP POLICY IF EXISTS "activites_insert" ON activites;
CREATE POLICY "activites_insert" ON activites FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = created_by AND public.can_access_projet(projet_id)
);

DROP POLICY IF EXISTS "activites_update" ON activites;
CREATE POLICY "activites_update" ON activites FOR UPDATE TO authenticated USING (
  public.can_access_projet(projet_id)
);

-- commentaires_activites : suit l'accès à l'activité/projet parent
DROP POLICY IF EXISTS "commentaires_select" ON commentaires_activites;
CREATE POLICY "commentaires_select" ON commentaires_activites FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM activites a WHERE a.id = commentaires_activites.activite_id AND public.can_access_projet(a.projet_id))
);

DROP POLICY IF EXISTS "commentaires_insert" ON commentaires_activites;
CREATE POLICY "commentaires_insert" ON commentaires_activites FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = auteur_id
  AND EXISTS (SELECT 1 FROM activites a WHERE a.id = activite_id AND public.can_access_projet(a.projet_id))
);

NOTIFY pgrst, 'reload schema';
