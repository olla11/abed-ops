-- Migration 100 : implémente la Politique de rémunération PG N° 002-25/DE-ABED
-- ONG (adoptée par le CA le 31 juillet 2026) — 4 barèmes distincts, tous
-- réservés à CAF/admin/superadmin en écriture (seul le CAF fixe les prix,
-- comme demandé) :
--   1. bareme_honoraires   — Tableau 2 : taux horaire des prestataires par
--      niveau de fonction (+ ancienneté pour Programme Lead/Manager et
--      Chargé de Projet) et prime de communication mensuelle.
--   2. grilles_salaires    — Tableau 3 : salaire brut + primes des CDI/CDD
--      par grade (A1→D2) et échelon (YX-1→YX-4).
--   3. bareme_allocations  — Tableau 1 : allocation mensuelle des bénévoles
--      (par niveau) et stagiaires (N1/N2).
--   4. Paliers de prime de communication (0-100h/100-200h/200h+), identiques
--      pour les 3 niveaux qui y ont droit — stockés dans `parametres`
--      (table clé-valeur déjà existante et déjà réservée à caf/admin).
--
-- profiles.seniorite est ajouté pour distinguer Sénior/Medium/Junior là où
-- le barème le prévoit (Programme Lead/Manager, Chargé de Projet).
--
-- Le "niveau_fonction" d'une personne pour ces barèmes est dérivé de son
-- titre (voir lib/bareme.ts pour le mapping complet, miroir SQL ci-dessous
-- dans get_niveau_fonction_honoraire) — pas une colonne séparée, pour éviter
-- toute divergence avec le titre géré depuis l'écran Titres.

CREATE TYPE niveau_fonction_honoraire AS ENUM (
  'directeur', 'programme_lead_manager', 'charge_projet', 'agent_projet',
  'animateur', 'assistant', 'conducteur', 'agent_entretien'
);

CREATE TYPE seniorite_niveau AS ENUM ('senior', 'medium', 'junior');

CREATE TYPE type_prime_communication AS ENUM ('paliers_heures', 'fixe', 'aucune', 'budget_projet');

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seniorite seniorite_niveau;

-- ── 1. Barème honoraires (Tableau 2) ────────────────────────────────────
CREATE TABLE public.bareme_honoraires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niveau_fonction niveau_fonction_honoraire NOT NULL,
  seniorite seniorite_niveau,
  type_prestation text NOT NULL CHECK (type_prestation IN ('direct', 'credit')),
  montant_heure numeric NOT NULL CHECK (montant_heure > 0),
  prime_communication_type type_prime_communication NOT NULL DEFAULT 'aucune',
  prime_communication_fixe numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_par uuid REFERENCES public.profiles(id)
);
CREATE UNIQUE INDEX bareme_honoraires_avec_seniorite_uidx
  ON public.bareme_honoraires (niveau_fonction, seniorite) WHERE seniorite IS NOT NULL;
CREATE UNIQUE INDEX bareme_honoraires_sans_seniorite_uidx
  ON public.bareme_honoraires (niveau_fonction) WHERE seniorite IS NULL;

INSERT INTO public.bareme_honoraires (niveau_fonction, seniorite, type_prestation, montant_heure, prime_communication_type, prime_communication_fixe) VALUES
  ('directeur',              NULL,     'credit', 4000, 'paliers_heures', NULL),
  ('programme_lead_manager', 'senior', 'credit', 3800, 'paliers_heures', NULL),
  ('programme_lead_manager', 'medium', 'credit', 3500, 'paliers_heures', NULL),
  ('programme_lead_manager', 'junior', 'credit', 3000, 'paliers_heures', NULL),
  ('charge_projet',          'senior', 'direct', 2800, 'paliers_heures', NULL),
  ('charge_projet',          'medium', 'direct', 2500, 'paliers_heures', NULL),
  ('charge_projet',          'junior', 'direct', 2000, 'paliers_heures', NULL),
  ('agent_projet',           NULL,     'direct', 1800, 'budget_projet',  NULL),
  ('animateur',              NULL,     'direct', 1500, 'budget_projet',  NULL),
  ('assistant',              NULL,     'direct', 1000, 'budget_projet',  NULL),
  ('conducteur',             NULL,     'direct',  800, 'fixe',           10000),
  ('agent_entretien',        NULL,     'direct',  500, 'aucune',         NULL);

-- Paliers de prime de communication (identiques pour tous les niveaux en
-- 'paliers_heures') : 0-100h, 100-200h, 200h et plus.
INSERT INTO public.parametres (cle, valeur) VALUES
  ('prime_comm_palier1_borne_max', '100'),
  ('prime_comm_palier1_montant',   '15000'),
  ('prime_comm_palier2_borne_max', '200'),
  ('prime_comm_palier2_montant',   '25000'),
  ('prime_comm_palier3_montant',   '35000')
ON CONFLICT (cle) DO NOTHING;

-- ── 2. Grille salariale CDI/CDD (Tableau 3) ─────────────────────────────
CREATE TABLE public.grilles_salaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade text NOT NULL CHECK (grade IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2')),
  echelon text NOT NULL CHECK (echelon IN ('YX-1', 'YX-2', 'YX-3', 'YX-4')),
  salaire_brut numeric NOT NULL CHECK (salaire_brut > 0),
  prime_diverses numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_par uuid REFERENCES public.profiles(id),
  UNIQUE (grade, echelon)
);

INSERT INTO public.grilles_salaires (grade, echelon, salaire_brut, prime_diverses) VALUES
  ('A1', 'YX-1', 670000, 200000), ('A1', 'YX-2', 630000, 150000), ('A1', 'YX-3', 570000, 100000), ('A1', 'YX-4', 520000, 58000),
  ('A2', 'YX-1', 500000, 58000),  ('A2', 'YX-2', 440000, 55000),  ('A2', 'YX-3', 420000, 53000),  ('A2', 'YX-4', 370000, 50000),
  ('B1', 'YX-1', 310000, 50000),  ('B1', 'YX-2', 270000, 46000),  ('B1', 'YX-3', 240000, 44000),  ('B1', 'YX-4', 240000, 40000),
  ('B2', 'YX-1', 170000, 40000),  ('B2', 'YX-2', 160000, 35000),  ('B2', 'YX-3', 150000, 30000),  ('B2', 'YX-4', 140000, 28000),
  ('C1', 'YX-1', 140000, 28000),  ('C1', 'YX-2', 130000, 25000),  ('C1', 'YX-3', 125000, 22000),  ('C1', 'YX-4', 120000, 20000),
  ('C2', 'YX-1', 105000, 20000),  ('C2', 'YX-2', 104000, 18000),  ('C2', 'YX-3', 102000, 8000),   ('C2', 'YX-4', 100000, 16000),
  ('D1', 'YX-1',  85000, 16000),  ('D1', 'YX-2',  84000, 14000),  ('D1', 'YX-3',  82000, 12000),  ('D1', 'YX-4',  80000, 10000),
  ('D2', 'YX-1',  65000, 10000),  ('D2', 'YX-2',  64000,  8000),  ('D2', 'YX-3',  62000,  6000),  ('D2', 'YX-4',  60000,  5000);

-- ── 3. Allocations bénévoles / stagiaires (Tableau 1) ───────────────────
CREATE TABLE public.bareme_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_emploi type_emploi NOT NULL,
  niveau_fonction niveau_fonction_honoraire,
  montant_mensuel numeric NOT NULL CHECK (montant_mensuel > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_par uuid REFERENCES public.profiles(id)
);
CREATE UNIQUE INDEX bareme_allocations_avec_niveau_uidx
  ON public.bareme_allocations (type_emploi, niveau_fonction) WHERE niveau_fonction IS NOT NULL;
CREATE UNIQUE INDEX bareme_allocations_sans_niveau_uidx
  ON public.bareme_allocations (type_emploi) WHERE niveau_fonction IS NULL;

INSERT INTO public.bareme_allocations (type_emploi, niveau_fonction, montant_mensuel) VALUES
  ('benevole', 'assistant',              12000),
  ('benevole', 'agent_projet',           15000),  -- "intermédiaire (superviseur, terrain)"
  ('benevole', 'charge_projet',          18000),
  ('benevole', 'programme_lead_manager', 25000),  -- "Lead/Manager/Directeur"
  ('benevole', 'directeur',              25000),
  ('stagiaire_n1', NULL, 35000),
  ('stagiaire_n2', NULL, 60000);

-- ── RLS : lecture large (personnel), écriture caf/admin/superadmin uniquement ──
ALTER TABLE public.bareme_honoraires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grilles_salaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bareme_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecture bareme_honoraires" ON public.bareme_honoraires FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ecriture bareme_honoraires" ON public.bareme_honoraires FOR ALL
  USING (public."current_role"() = ANY (ARRAY['caf','admin','superadmin']::user_role[]))
  WITH CHECK (public."current_role"() = ANY (ARRAY['caf','admin','superadmin']::user_role[]));

CREATE POLICY "lecture grilles_salaires" ON public.grilles_salaires FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ecriture grilles_salaires" ON public.grilles_salaires FOR ALL
  USING (public."current_role"() = ANY (ARRAY['caf','admin','superadmin']::user_role[]))
  WITH CHECK (public."current_role"() = ANY (ARRAY['caf','admin','superadmin']::user_role[]));

CREATE POLICY "lecture bareme_allocations" ON public.bareme_allocations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ecriture bareme_allocations" ON public.bareme_allocations FOR ALL
  USING (public."current_role"() = ANY (ARRAY['caf','admin','superadmin']::user_role[]))
  WITH CHECK (public."current_role"() = ANY (ARRAY['caf','admin','superadmin']::user_role[]));

GRANT SELECT ON public.bareme_honoraires, public.grilles_salaires, public.bareme_allocations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bareme_honoraires, public.grilles_salaires, public.bareme_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bareme_honoraires, public.grilles_salaires, public.bareme_allocations TO service_role;

NOTIFY pgrst, 'reload schema';
