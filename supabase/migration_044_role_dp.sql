-- Migration 044 : ajoute le rôle "dp" (Directeur des Programmes) — mêmes droits que "de"
-- pour l'instant, mais distinct pour permettre une différenciation future.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dp';
ALTER TYPE titre_poste ADD VALUE IF NOT EXISTS 'directeur_programmes';

-- ---------- RLS : ajoute 'dp' partout où 'de' a des droits ----------

ALTER POLICY "conges_visibility" ON conges USING (
  (profile_id = auth.uid()) OR (valideur_n1_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['rh','admin','de','dp','administrateur']::user_role[])
  ))
);

ALTER POLICY "contrats_insert_rh" ON contrats WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['rh','admin','de','dp']::user_role[]))
);

ALTER POLICY "contrats_rh" ON contrats USING (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['rh','admin','de','dp']::user_role[]))) OR (profile_id = auth.uid())
);

ALTER POLICY "select_demandes" ON demandes_paiement USING (
  (demandeur_id = auth.uid()) OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['aaf','caf','de','dp','admin','administrateur']::user_role[])))
);

ALTER POLICY "update_demandes" ON demandes_paiement USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['aaf','caf','de','dp','admin']::user_role[]))
);

ALTER POLICY "evaluation_visibility" ON evaluations USING (
  (profile_id = auth.uid()) OR (evaluateur_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['rh','admin','de','dp']::user_role[])
  ))
);

ALTER POLICY "missionnaire modifie ses missions non cloturees" ON missions USING (
  ((missionnaire_id = auth.uid()) AND (status <> 'cloture'::om_status))
  OR ("current_role"() = ANY (ARRAY['caf','de','dp','admin','administrateur']::user_role[]))
);

ALTER POLICY "missionnaire voit ses missions" ON missions USING (
  (missionnaire_id = auth.uid())
  OR ("current_role"() = ANY (ARRAY['caf','de','dp','admin','administrateur']::user_role[]))
);

ALTER POLICY "missions_select" ON missions USING (
  (auth.uid() = missionnaire_id) OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['caf','de','dp','admin','rh']::user_role[])))
);

ALTER POLICY "prestataire voit ses paiements" ON paiements_prestataires USING (
  (prestataire_id = auth.uid()) OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['caf','admin','de','dp','administrateur']::user_role[])))
);

ALTER POLICY "voir paiements de ses missions ou caf/de" ON payments USING (
  EXISTS (SELECT 1 FROM missions m WHERE m.id = payments.mission_id
    AND (m.missionnaire_id = auth.uid() OR "current_role"() = ANY (ARRAY['caf','de','dp','admin','administrateur']::user_role[])))
);

ALTER POLICY "lire son profil ou tout si caf/de/admin" ON profiles USING (
  (id = auth.uid()) OR ("current_role"() = ANY (ARRAY['caf','de','dp','admin','manager']::user_role[]))
);

ALTER POLICY "select_rapports_alloc" ON rapports_allocations USING (
  (prestataire_id = auth.uid()) OR (manager_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['aaf','caf','de','dp','admin','administrateur']::user_role[])
  ))
);

ALTER POLICY "update_rapports_alloc" ON rapports_allocations USING (
  (manager_id = auth.uid()) OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['aaf','caf','de','dp','admin']::user_role[])))
);

ALTER POLICY "prestataire et manager voient la soumission" ON soumissions USING (
  (prestataire_id = auth.uid()) OR (manager_id = auth.uid())
  OR ("current_role"() = ANY (ARRAY['caf','de','dp','admin','rh']::user_role[]))
);

ALTER POLICY "soumissions update" ON soumissions
USING (
  (manager_id = auth.uid()) OR (prestataire_id = auth.uid())
  OR ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['caf','admin','de','dp']::user_role[]))
)
WITH CHECK (
  (manager_id = auth.uid()) OR (prestataire_id = auth.uid())
  OR ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['caf','admin','de','dp']::user_role[]))
);

ALTER POLICY "prestataire et son manager voient le timesheet" ON timesheets USING (
  (prestataire_id = auth.uid()) OR (manager_id = auth.uid())
  OR ("current_role"() = ANY (ARRAY['caf','de','dp','admin']::user_role[]))
);

-- ---------- Mapping titre "directeur_programmes" -> accès "dp" par défaut ----------

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
      WHEN 'directeur_executif'    THEN 'de'
      WHEN 'directeur_programmes'  THEN 'dp'
      WHEN 'caf'                   THEN 'caf'
      WHEN 'rh'                    THEN 'rh'
      WHEN 'aaf'                   THEN 'aaf'
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
END $function$;

NOTIFY pgrst, 'reload schema';
