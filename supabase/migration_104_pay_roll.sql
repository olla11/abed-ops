-- Phase 0 du chantier "Pay Roll" (CAF Pro) : file d'attente centrale des
-- paiements autorisés par le DE, comptes bancaires éditables, budget adopté
-- par code/année (nécessaire pour calculer réalisation cumulée/disponibilité
-- sur l'appel de fonds), appels de fonds + leurs lignes, et le journal des
-- dépenses effectivement exécutées (alimente l'exécution financière temps
-- réel). Voir le plan validé avec l'utilisateur : timesheets auront une
-- étape d'autorisation DE ajoutée en Phase 1 ; le budget adopté est saisi
-- ici plutôt que reporté à plus tard ; l'AAF marque payé ligne par ligne.

-- ── Comptes bancaires (liste éditable, remplace les 2 comptes en dur) ──────
CREATE TABLE comptes_bancaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO comptes_bancaires (nom, ordre) VALUES
  ('ABED Principal', 1),
  ('CLEE-2i', 2);

ALTER TABLE comptes_bancaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_comptes_bancaires ON comptes_bancaires FOR SELECT USING (true);
CREATE POLICY write_comptes_bancaires ON comptes_bancaires FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE comptes_bancaires TO anon, authenticated, service_role;

-- ── Budget adopté par code budgétaire et par année ─────────────────────────
CREATE TABLE budget_adopte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_budgetaire text NOT NULL REFERENCES codes_budgetaires(code) ON DELETE CASCADE,
  annee integer NOT NULL,
  montant_annuel numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_budgetaire, annee)
);

ALTER TABLE budget_adopte ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_budget_adopte ON budget_adopte FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','de','dp','administrateur','admin','superadmin'))
);
CREATE POLICY write_budget_adopte ON budget_adopte FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE budget_adopte TO anon, authenticated, service_role;

-- ── Pay Roll : file centrale des paiements autorisés par le DE ────────────
CREATE TABLE pay_roll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('demande_paiement','rapport_allocation','reconciliation_mission','timesheet')),
  source_id uuid NOT NULL,
  reference text,
  beneficiaire_id uuid REFERENCES profiles(id),
  beneficiaire_nom text NOT NULL,
  objet text NOT NULL,
  code_budgetaire text REFERENCES codes_budgetaires(code),
  montant numeric(14,2) NOT NULL,
  statut text NOT NULL DEFAULT 'non_paye' CHECK (statut IN ('non_paye','a_payer','paye')),
  compte_bancaire_id uuid REFERENCES comptes_bancaires(id),
  appel_de_fonds_id uuid,
  autorise_de_le timestamptz,
  paye_le timestamptz,
  paye_par uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

ALTER TABLE pay_roll ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_pay_roll ON pay_roll FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('caf','aaf','de','dp','administrateur','admin','superadmin')))
);
CREATE POLICY write_pay_roll ON pay_roll FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE pay_roll TO anon, authenticated, service_role;

-- ── Appels de fonds (en-tête du document) ──────────────────────────────────
CREATE TABLE appels_de_fonds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  date_demande date NOT NULL DEFAULT current_date,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','circuit_signature','signe','rejete')),
  commentaire_caf text,
  montant_total numeric(14,2) NOT NULL DEFAULT 0,
  demande_signature_id uuid REFERENCES demandes_signature(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appels_de_fonds ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_appels_de_fonds ON appels_de_fonds FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('caf','aaf','de','dp','administrateur','admin','superadmin')))
);
CREATE POLICY write_appels_de_fonds ON appels_de_fonds FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE appels_de_fonds TO anon, authenticated, service_role;

-- Le pay_roll.appel_de_fonds_id ne peut référencer appels_de_fonds qu'une
-- fois cette dernière créée.
ALTER TABLE pay_roll ADD CONSTRAINT pay_roll_appel_de_fonds_id_fkey
  FOREIGN KEY (appel_de_fonds_id) REFERENCES appels_de_fonds(id);

-- ── Lignes de l'appel de fonds (regroupées par code budgétaire) ───────────
CREATE TABLE appel_de_fonds_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appel_de_fonds_id uuid NOT NULL REFERENCES appels_de_fonds(id) ON DELETE CASCADE,
  code_budgetaire text REFERENCES codes_budgetaires(code),
  libelle_ligne text NOT NULL,
  montant_prevu numeric(14,2) NOT NULL DEFAULT 0,
  realisation_cumulee numeric(14,2) NOT NULL DEFAULT 0,
  disponibilite numeric(14,2) NOT NULL DEFAULT 0,
  montant_demande numeric(14,2) NOT NULL DEFAULT 0,
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appel_de_fonds_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_appel_de_fonds_lignes ON appel_de_fonds_lignes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('caf','aaf','de','dp','administrateur','admin','superadmin')))
);
CREATE POLICY write_appel_de_fonds_lignes ON appel_de_fonds_lignes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','admin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE appel_de_fonds_lignes TO anon, authenticated, service_role;

-- ── Dépenses exécutées (journal auto, alimente l'exécution financière) ────
CREATE TABLE depenses_executees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_roll_id uuid REFERENCES pay_roll(id),
  code_budgetaire text REFERENCES codes_budgetaires(code),
  montant numeric(14,2) NOT NULL,
  date_paiement date NOT NULL DEFAULT current_date,
  source_type text,
  source_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE depenses_executees ENABLE ROW LEVEL SECURITY;
-- Écrit uniquement via le client service (route "marquer payé") : aucune
-- politique d'écriture pour les rôles applicatifs, seule la lecture est
-- ouverte aux rôles qui pilotent le budget.
CREATE POLICY select_depenses_executees ON depenses_executees FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('caf','de','dp','administrateur','admin','superadmin'))
);
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON TABLE depenses_executees TO anon, authenticated, service_role;
