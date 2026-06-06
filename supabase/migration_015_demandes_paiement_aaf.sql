-- Migration 015 : Demandes de paiement + Rapports allocations + rôle AAF

-- 1. Ajouter le rôle 'aaf' à l'enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'aaf';

-- 2. Table des départements
CREATE TABLE IF NOT EXISTS departements (
  id   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom  text NOT NULL UNIQUE,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
INSERT INTO departements (nom, ordre) VALUES
  ('Direction Exécutive', 1),
  ('Programmes & Projets', 2),
  ('Administration & Finances', 3),
  ('Développement organisationnel', 4),
  ('Conseil d''administration', 5),
  ('Comité d''Éthique et de Discipline', 6),
  ('Exploitation', 7)
ON CONFLICT (nom) DO NOTHING;

-- 3. Table des codes budgétaires
CREATE TABLE IF NOT EXISTS codes_budgetaires (
  id    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code  text NOT NULL UNIQUE,
  libelle text NOT NULL,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
INSERT INTO codes_budgetaires (code, libelle, ordre) VALUES
  ('ADM01','Charges locatives',1),
  ('ADM02','Administration et salaires',2),
  ('ADM03','Marketing et communication',3),
  ('ADM04','Matériel',4),
  ('PRG01','Projet JFAII Élevage',5),
  ('PRG02','Projet D''croch et PCEI-EA',6),
  ('PRG03','Recherche et Suivi-Évaluation',7),
  ('PRG04','Projet CLEE-2i',8),
  ('PRG05','Actions Paix',9),
  ('EXP01','ABED Invest',10),
  ('EXP02','Unexin',11),
  ('DEV01','Représentations et actions régionales',12),
  ('DEV02','Missions de partenariats',13),
  ('DEV03','Cotisations réseaux et forums',14),
  ('DEV04','Fonctionnement développement org.',15),
  ('GOV01','Sessions du CA',16),
  ('GOV02','Formations CA / Assemblée Générale',17),
  ('GOV03','Missions Président d''Honneur',18),
  ('DET01','Apurement dettes 2025',19)
ON CONFLICT (code) DO NOTHING;

-- 4. Table des projets / programmes
CREATE TABLE IF NOT EXISTS projets_programmes (
  id    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom   text NOT NULL UNIQUE,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
INSERT INTO projets_programmes (nom, ordre) VALUES
  ('Administration',1),('D''croch',2),('PCEI-EA',3),('JFAII',4),
  ('WiBIZ',5),('CLEE-2i',6),('Recherche & S&E',7),('Actions Paix',8),
  ('ABED Invest',9),('Unexin',10),('Développement Org.',11)
ON CONFLICT (nom) DO NOTHING;

-- 5. Table des natures de dépense
CREATE TABLE IF NOT EXISTS natures_depense (
  id    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom   text NOT NULL UNIQUE,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
INSERT INTO natures_depense (nom, ordre) VALUES
  ('Honoraires / Salaires / Allocation',1),
  ('Frais de mission',2),
  ('Transport / Déplacements',3),
  ('Restauration / Réception',4),
  ('Communication / Internet',5),
  ('Fournitures et matériel',6),
  ('Charges locatives',7),
  ('Prestation externe',8),
  ('Formation / Atelier',9),
  ('Publication / Impression',10),
  ('Cotisations / Adhésions',11)
ON CONFLICT (nom) DO NOTHING;

-- RLS pour les tables de référence (lecture pour tous authentifiés, écriture CAF/admin)
ALTER TABLE departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes_budgetaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE projets_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE natures_depense ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_dept" ON departements FOR SELECT USING (true);
CREATE POLICY "write_dept" ON departements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('caf','admin')));
CREATE POLICY "select_codes" ON codes_budgetaires FOR SELECT USING (true);
CREATE POLICY "write_codes" ON codes_budgetaires FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('caf','admin')));
CREATE POLICY "select_projets" ON projets_programmes FOR SELECT USING (true);
CREATE POLICY "write_projets" ON projets_programmes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('caf','admin')));
CREATE POLICY "select_natures" ON natures_depense FOR SELECT USING (true);
CREATE POLICY "write_natures" ON natures_depense FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('caf','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON departements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON codes_budgetaires TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projets_programmes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON natures_depense TO authenticated;

-- 6. Table des demandes de paiement
CREATE TABLE IF NOT EXISTS demandes_paiement (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  demandeur_id          uuid NOT NULL REFERENCES profiles(id),
  nom_complet           text NOT NULL,
  email_contact         text NOT NULL,
  departement           text NOT NULL,
  objet                 text NOT NULL,
  code_budgetaire       text NOT NULL,
  projet                text NOT NULL,
  nature_depense        text NOT NULL,
  montant               numeric(12,2) NOT NULL,
  mode_paiement         text NOT NULL,
  beneficiaire          text NOT NULL,
  reference_piece       text NOT NULL,
  justification         text NOT NULL,
  urgence               text NOT NULL DEFAULT 'normale',
  date_souhaitee        date,
  fichier_justificatif_url text,
  -- Workflow: soumis → valide_aaf → valide_caf → autorise | rejete_aaf | rejete_caf | refuse_de
  status                text NOT NULL DEFAULT 'soumis',
  aaf_id                uuid REFERENCES profiles(id),
  aaf_le                timestamptz,
  commentaire_aaf       text,
  caf_id                uuid REFERENCES profiles(id),
  caf_le                timestamptz,
  commentaire_caf       text,
  de_id                 uuid REFERENCES profiles(id),
  de_le                 timestamptz,
  commentaire_de        text,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE demandes_paiement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_demandes"
  ON demandes_paiement FOR SELECT
  USING (
    demandeur_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aaf','caf','de','admin','administrateur'))
  );

CREATE POLICY "insert_demandes"
  ON demandes_paiement FOR INSERT
  WITH CHECK (demandeur_id = auth.uid());

CREATE POLICY "update_demandes"
  ON demandes_paiement FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aaf','caf','de','admin')));

GRANT SELECT, INSERT, UPDATE ON demandes_paiement TO authenticated;

-- 7. Table des rapports d'allocations (bénévoles / stagiaires)
CREATE TABLE IF NOT EXISTS rapports_allocations (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prestataire_id    uuid NOT NULL REFERENCES profiles(id),
  manager_id        uuid NOT NULL REFERENCES profiles(id),
  periode_mois      int NOT NULL,
  periode_annee     int NOT NULL,
  montant_allocation numeric(12,2),
  rapport_texte     text,
  fichier_rapport_url text,
  -- Workflow: soumis → valide_tech → traite_aaf → valide_caf → autorise | rejets
  status            text NOT NULL DEFAULT 'soumis',
  commentaire_manager text,
  commentaire_aaf   text,
  commentaire_caf   text,
  commentaire_de    text,
  manager_valide_le timestamptz,
  aaf_id            uuid REFERENCES profiles(id),
  aaf_le            timestamptz,
  caf_id            uuid REFERENCES profiles(id),
  caf_le            timestamptz,
  de_id             uuid REFERENCES profiles(id),
  de_le             timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE rapports_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_rapports_alloc"
  ON rapports_allocations FOR SELECT
  USING (
    prestataire_id = auth.uid()
    OR manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aaf','caf','de','admin','administrateur'))
  );

CREATE POLICY "insert_rapports_alloc"
  ON rapports_allocations FOR INSERT
  WITH CHECK (prestataire_id = auth.uid());

CREATE POLICY "update_rapports_alloc"
  ON rapports_allocations FOR UPDATE
  USING (
    manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aaf','caf','de','admin'))
  );

GRANT SELECT, INSERT, UPDATE ON rapports_allocations TO authenticated;

-- 8. Mettre à jour attribuer_titre : aaf titre → rôle aaf
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
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF nouveau_role IS NOT NULL THEN
    access := nouveau_role;
  ELSE
    access := CASE nouveau_titre
      WHEN 'directeur_executif'    THEN 'de'
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
END $$;
