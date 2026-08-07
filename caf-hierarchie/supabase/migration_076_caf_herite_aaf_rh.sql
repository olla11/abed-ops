-- Migration 076 : le/la CAF est hiérarchiquement responsable de l'AAF et des
-- RH — il/elle doit voir et pouvoir agir sur tout ce que ces deux rôles
-- voient/peuvent faire, en plus de ses propres droits. Ajoute 'caf' partout
-- où seuls 'aaf' et/ou 'rh' avaient des droits jusqu'ici côté RLS (voir
-- aussi src/lib/roles.ts : estAAF()/estRH(), et les vérifications
-- applicatives correspondantes dans les routes API et l'UI).

ALTER POLICY "evaluation_visibility" ON evaluations USING (
  profile_id = auth.uid() OR
  evaluateur_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh','admin','de','caf'))
);

ALTER POLICY "conges_visibility" ON conges USING (
  (profile_id = auth.uid()) OR (valideur_n1_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['rh','admin','de','dp','administrateur','caf']::user_role[])
  ))
);

ALTER POLICY "soldes_own" ON soldes_conges USING (
  profile_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh','admin','caf'))
);

ALTER POLICY "contrats_rh" ON contrats USING (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['rh','admin','de','dp','caf']::user_role[]))) OR (profile_id = auth.uid())
);

ALTER POLICY "ressources_insert_rh_admin" ON ressources WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh', 'admin', 'caf'))
);
ALTER POLICY "ressources_update_rh_admin" ON ressources USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh', 'admin', 'caf'))
);
ALTER POLICY "ressources_delete_rh_admin" ON ressources USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('rh', 'admin', 'caf'))
);

ALTER POLICY "directions_write_rh" ON directions WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('rh', 'admin', 'superadmin', 'caf'))
);
ALTER POLICY "directions_update_rh" ON directions USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('rh', 'admin', 'superadmin', 'caf'))
);
ALTER POLICY "directions_delete_rh" ON directions USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('rh', 'admin', 'superadmin', 'caf'))
);

-- can_access_tdr() : le bypass "voit tout" n'incluait que admin/rh — ajoute caf.
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
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'rh', 'caf'))
    )
  );
$$;
