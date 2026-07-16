-- Migration 049 : système de rédaction, collaboration et signature des TDR
-- (Termes de Référence), avec génération PDF et téléchargement public une
-- fois le TDR actif.

CREATE TABLE IF NOT EXISTS tdrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text,
  titre_activite text NOT NULL,
  projet text,
  periode text,
  initiateur_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  responsable_technique_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (
    statut IN ('brouillon', 'en_validation_technique', 'en_validation_caf', 'en_autorisation_de', 'actif', 'cloture')
  ),
  chapitres jsonb NOT NULL DEFAULT '[]'::jsonb,
  dernier_refus_par uuid REFERENCES profiles(id) ON DELETE SET NULL,
  dernier_refus_commentaire text,
  dernier_refus_le timestamptz,
  cloture_par uuid REFERENCES profiles(id) ON DELETE SET NULL,
  cloture_le timestamptz,
  cloture_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tdr_collaborateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tdr_id uuid NOT NULL REFERENCES tdrs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'lecture' CHECK (permission IN ('lecture', 'revision')),
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tdr_id, profile_id)
);

CREATE TABLE IF NOT EXISTS tdr_signataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tdr_id uuid NOT NULL REFERENCES tdrs(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('initiateur', 'responsable_technique', 'caf', 'de')),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ordre int NOT NULL,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'signe', 'refuse')),
  signe_le timestamptz,
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tdr_id, role)
);

CREATE TABLE IF NOT EXISTS tdr_commentaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tdr_id uuid NOT NULL REFERENCES tdrs(id) ON DELETE CASCADE,
  auteur_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  contenu text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tdrs_initiateur ON tdrs(initiateur_id);
CREATE INDEX IF NOT EXISTS idx_tdrs_statut ON tdrs(statut);
CREATE INDEX IF NOT EXISTS idx_tdr_collaborateurs_tdr ON tdr_collaborateurs(tdr_id);
CREATE INDEX IF NOT EXISTS idx_tdr_collaborateurs_profile ON tdr_collaborateurs(profile_id);
CREATE INDEX IF NOT EXISTS idx_tdr_signataires_tdr ON tdr_signataires(tdr_id);
CREATE INDEX IF NOT EXISTS idx_tdr_signataires_profile ON tdr_signataires(profile_id);
CREATE INDEX IF NOT EXISTS idx_tdr_commentaires_tdr ON tdr_commentaires(tdr_id);

-- ---------- RLS ----------
ALTER TABLE tdrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdr_collaborateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdr_signataires ENABLE ROW LEVEL SECURITY;
ALTER TABLE tdr_commentaires ENABLE ROW LEVEL SECURITY;

-- Un TDR "actif" ou "cloturé" est téléchargeable/visible par tout le monde ;
-- avant ça, seuls l'initiateur, les collaborateurs et les signataires y ont accès.
CREATE OR REPLACE FUNCTION public.can_access_tdr(p_tdr_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tdrs t
    WHERE t.id = p_tdr_id
    AND (
      t.statut IN ('actif', 'cloture')
      OR t.initiateur_id = auth.uid()
      OR EXISTS (SELECT 1 FROM tdr_collaborateurs c WHERE c.tdr_id = t.id AND c.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM tdr_signataires s WHERE s.tdr_id = t.id AND s.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'rh'))
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_access_tdr(uuid) TO authenticated;

CREATE POLICY "tdrs_select" ON tdrs FOR SELECT TO authenticated USING (public.can_access_tdr(id));
CREATE POLICY "tdrs_insert" ON tdrs FOR INSERT TO authenticated WITH CHECK (initiateur_id = auth.uid());
CREATE POLICY "tdrs_update" ON tdrs FOR UPDATE TO authenticated USING (
  initiateur_id = auth.uid()
  OR EXISTS (SELECT 1 FROM tdr_collaborateurs c WHERE c.tdr_id = id AND c.profile_id = auth.uid() AND c.permission = 'revision')
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'caf'))
);

CREATE POLICY "tdr_collaborateurs_select" ON tdr_collaborateurs FOR SELECT TO authenticated USING (public.can_access_tdr(tdr_id));
CREATE POLICY "tdr_collaborateurs_insert" ON tdr_collaborateurs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM tdrs t WHERE t.id = tdr_id AND t.initiateur_id = auth.uid())
);
CREATE POLICY "tdr_collaborateurs_delete" ON tdr_collaborateurs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM tdrs t WHERE t.id = tdr_id AND t.initiateur_id = auth.uid())
);

CREATE POLICY "tdr_signataires_select" ON tdr_signataires FOR SELECT TO authenticated USING (public.can_access_tdr(tdr_id));

CREATE POLICY "tdr_commentaires_select" ON tdr_commentaires FOR SELECT TO authenticated USING (public.can_access_tdr(tdr_id));
CREATE POLICY "tdr_commentaires_insert" ON tdr_commentaires FOR INSERT TO authenticated WITH CHECK (
  auteur_id = auth.uid() AND public.can_access_tdr(tdr_id)
);

-- Les tables tdr_signataires et l'essentiel des transitions de statut sont
-- gérées côté serveur via le client admin (logique métier + ordre de
-- signature vérifiés dans les routes API), comme pour les autres circuits
-- de validation de l'application (rapports-allocations, demandes-paiement).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdrs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdr_collaborateurs TO authenticated;
GRANT SELECT ON public.tdr_signataires TO authenticated;
GRANT SELECT, INSERT ON public.tdr_commentaires TO authenticated;

GRANT ALL ON public.tdrs TO service_role;
GRANT ALL ON public.tdr_collaborateurs TO service_role;
GRANT ALL ON public.tdr_signataires TO service_role;
GRANT ALL ON public.tdr_commentaires TO service_role;

NOTIFY pgrst, 'reload schema';
