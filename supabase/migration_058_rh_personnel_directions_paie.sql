-- Enrichissement de la fiche personnel (RH) : genre (nécessaire au KPI
-- % femmes), ville, niveau d'étude, nombre d'enfants. Éditable par RH via
-- /rh/personnel.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS genre text CHECK (genre IN ('M', 'F'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS niveau_etude text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nombre_enfants int;

-- Liste des directions/services, éditable par le RH (contrairement aux
-- autres listes de /parametres — départements budgétaires, codes, projets,
-- natures de dépense — qui restent réservées à CAF/admin).
CREATE TABLE IF NOT EXISTS directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO directions (nom, ordre) VALUES
  ('Direction Exécutive', 1),
  ('Direction de l''Exploitation', 2),
  ('Direction des Programmes', 3),
  ('Administration', 4)
ON CONFLICT DO NOTHING;

ALTER TABLE directions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "directions_select_all" ON directions FOR SELECT TO authenticated USING (true);
CREATE POLICY "directions_write_rh" ON directions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('rh', 'admin', 'superadmin'))
);
CREATE POLICY "directions_update_rh" ON directions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('rh', 'admin', 'superadmin'))
);
CREATE POLICY "directions_delete_rh" ON directions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('rh', 'admin', 'superadmin'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.directions TO authenticated;
GRANT ALL ON public.directions TO service_role;

-- Paramètres de paie (taux CNSS employé + barème ITS progressif), éditables
-- par RH — voir /rh/parametres. Stockés dans la table parametres existante
-- (clé/valeur texte) ; le barème ITS est un JSON de tranches.
INSERT INTO parametres (cle, valeur) VALUES
  ('taux_cnss_employe', '3.6'),
  ('bareme_its', '[{"jusqua":60000,"taux":0},{"jusqua":130000,"taux":10},{"jusqua":280000,"taux":15},{"jusqua":530000,"taux":20},{"jusqua":null,"taux":25}]')
ON CONFLICT (cle) DO NOTHING;
