-- Complète le référentiel des codes budgétaires (5 rubriques + GOV03/DET01/
-- DET02 manquaient — 17 codes sur 25 réels), importe le budget adopté 2026
-- officiel, et rattrape les 14 paiements déjà autorisés qui n'existaient
-- jusqu'ici que dans le classeur Excel "Paiements approuvés".

INSERT INTO codes_budgetaires (code, libelle, ordre) VALUES
  ('ADM00', 'Administration et fonctionnement', 1),
  ('PRG00', 'Programmes d''intervention', 6),
  ('EXP00', 'Exploitation', 12),
  ('DEV00', 'Développement organisationnel et partenariats', 15),
  ('GOV00', 'Gouvernance (CA, PH, AG, CED)', 20),
  ('GOV03', 'Missions PH', 23),
  ('DET01', 'Dettes 2025', 24),
  ('DET02', 'Imprévus (3%)', 25)
ON CONFLICT (code) DO UPDATE SET libelle = EXCLUDED.libelle, ordre = EXCLUDED.ordre;

UPDATE codes_budgetaires SET ordre = 2 WHERE code = 'ADM01';
UPDATE codes_budgetaires SET ordre = 3 WHERE code = 'ADM02';
UPDATE codes_budgetaires SET ordre = 4 WHERE code = 'ADM03';
UPDATE codes_budgetaires SET ordre = 5 WHERE code = 'ADM04';
UPDATE codes_budgetaires SET ordre = 7 WHERE code = 'PRG01';
UPDATE codes_budgetaires SET ordre = 8 WHERE code = 'PRG02';
UPDATE codes_budgetaires SET ordre = 9 WHERE code = 'PRG03';
UPDATE codes_budgetaires SET ordre = 10 WHERE code = 'PRG04';
UPDATE codes_budgetaires SET ordre = 11 WHERE code = 'PRG05';
UPDATE codes_budgetaires SET ordre = 13 WHERE code = 'EXP01';
UPDATE codes_budgetaires SET ordre = 14 WHERE code = 'EXP02';
UPDATE codes_budgetaires SET ordre = 16 WHERE code = 'DEV01';
UPDATE codes_budgetaires SET ordre = 17 WHERE code = 'DEV02';
UPDATE codes_budgetaires SET ordre = 18 WHERE code = 'DEV03';
UPDATE codes_budgetaires SET ordre = 19 WHERE code = 'DEV04';
UPDATE codes_budgetaires SET ordre = 21 WHERE code = 'GOV01';
UPDATE codes_budgetaires SET ordre = 22 WHERE code = 'GOV02';

INSERT INTO budget_adopte (code_budgetaire, annee, montant_annuel) VALUES
  ('ADM00', 2026, 30770093), ('ADM01', 2026, 3477593), ('ADM02', 2026, 25787500),
  ('ADM03', 2026, 1010000), ('ADM04', 2026, 495000),
  ('PRG00', 2026, 18680000), ('PRG01', 2026, 2220000), ('PRG02', 2026, 6185000),
  ('PRG03', 2026, 6380000), ('PRG04', 2026, 3835000), ('PRG05', 2026, 60000),
  ('EXP00', 2026, 2910000), ('EXP01', 2026, 2000000), ('EXP02', 2026, 910000),
  ('DEV00', 2026, 1570000), ('DEV01', 2026, 1070000), ('DEV02', 2026, 400000),
  ('DEV03', 2026, 60000), ('DEV04', 2026, 40000),
  ('GOV00', 2026, 480000), ('GOV01', 2026, 120000), ('GOV02', 2026, 200000), ('GOV03', 2026, 160000),
  ('DET01', 2026, 2877593), ('DET02', 2026, 1632303)
ON CONFLICT (code_budgetaire, annee) DO UPDATE SET montant_annuel = EXCLUDED.montant_annuel, updated_at = now();

-- Paiements déjà autorisés par le DE, tenus jusqu'ici uniquement dans le
-- classeur Excel (feuille PAIEMENT AUTORISE) — ces DDP-XXXX n'existent pas
-- dans demandes_paiement (créés avant que ce suivi ne passe par
-- l'application), donc source_id est généré, sans ligne réelle à
-- référencer. Code budgétaire non fourni par la feuille source : à classer
-- par la CAF dans Pay Roll, comme les allocations/timesheets/
-- réconciliations qui n'en ont pas non plus nativement.
INSERT INTO pay_roll (source_type, source_id, reference, beneficiaire_id, beneficiaire_nom, objet, montant, statut, compte_bancaire_id, paye_le)
VALUES
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-032', '46130228-4038-4215-9fd9-d15f85957e97', 'YESSOUFOU Barikis', 'Honoraires de Prestation de Chargée de Projet Formation Insertion Professionnelle Janvier', 56000, 'a_payer', NULL, NULL),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-035', '46130228-4038-4215-9fd9-d15f85957e97', 'YESSOUFOU Barikis', 'Honoraires de Prestation de Chargée de Projet Formation Insertion Professionnelle Février', 91000, 'paye', NULL, now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-037', 'e463033e-cd11-4b36-93e3-711fdfd57e64', 'MESSAN Obiège', 'Frais de communication du mois de juin 2026', 12000, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-038', '4c620b49-4ff6-4dcb-8866-d53351f5b14b', 'AGLOSSI Isidore', 'Frais de restauration et d''achat d''eau pour la mission de visite de terrain et de consolidation du diagnostic des SAE', 26390, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-039', '4c620b49-4ff6-4dcb-8866-d53351f5b14b', 'AGLOSSI Isidore', 'Frais de restauration et de prestation de clôture de la cérémonie du programme d''employabilité CLEE-2i, de tee-shirts pour l''organisation du job dating', 462500, 'paye', 'b2422583-50b6-4109-9fb2-b62bdbb1751d', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-040', '4c620b49-4ff6-4dcb-8866-d53351f5b14b', 'AGLOSSI Isidore', 'Honoraire de l''AAF Mai 2026', 35000, 'paye', NULL, now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-041', '4c620b49-4ff6-4dcb-8866-d53351f5b14b', 'AGLOSSI Isidore', 'Honoraire de l''AAF Juin 2026', 35000, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-042', NULL, 'BOGNON Evariste', 'Demande de prévision du crédit du compteur SBEE sur deux mois', 20000, 'paye', 'b2422583-50b6-4109-9fb2-b62bdbb1751d', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-043', NULL, 'BOGNON Evariste', 'Frais de communication du mois de Juin 2026', 50000, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-044', NULL, 'AMETONOU K. Chadrack', 'Allocation du mois de juin 2026', 60000, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-045', NULL, 'MOUKOUTAR F. Aboubakar', 'Honoraire de prestation conseiller en employabilité juin 2026', 40495, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-046', NULL, 'ADEKAMBI Habila', 'Honoraire de prestation conseiller en employabilité juin 2026', 41050, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-047', NULL, 'OTTOKOU Codjo Adam', 'Honoraire de prestation conseiller en employabilité juin 2026', 43240, 'paye', 'c4e8a0d5-f663-4f49-9b16-bf1fba304169', now()),
  ('demande_paiement', gen_random_uuid(), 'DDP-2026-019', NULL, 'VIGNONFODO Sourou Eric', 'Honoraire prestataire individuel de services - CLEE-2i employabilité - Mai 2026', 87000, 'paye', 'b2422583-50b6-4109-9fb2-b62bdbb1751d', now());

INSERT INTO depenses_executees (pay_roll_id, code_budgetaire, montant, date_paiement, source_type, source_id, description)
SELECT id, code_budgetaire, montant, CURRENT_DATE, source_type, source_id, reference || ' — ' || beneficiaire_nom || ' — ' || objet
FROM pay_roll
WHERE reference IN ('DDP-2026-035','DDP-2026-037','DDP-2026-038','DDP-2026-039','DDP-2026-040','DDP-2026-041','DDP-2026-042','DDP-2026-043','DDP-2026-044','DDP-2026-045','DDP-2026-046','DDP-2026-047','DDP-2026-019')
  AND statut = 'paye';
