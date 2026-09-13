-- Le budget adopté n'était stocké qu'en montant annuel — l'Excel source
-- ("Budget Adopté CA") définit en réalité une répartition par trimestre
-- (souvent inégale, ex. PRG04 : 1 150 500 / 1 150 500 / 767 000 / 767 000),
-- utile pour comparer le dépensé du trimestre à ce qui était prévu pour LUI
-- plutôt qu'à une simple division par 4 du budget annuel.
ALTER TABLE budget_adopte
  ADD COLUMN t1_montant numeric(14,2),
  ADD COLUMN t2_montant numeric(14,2),
  ADD COLUMN t3_montant numeric(14,2),
  ADD COLUMN t4_montant numeric(14,2);

UPDATE budget_adopte SET t1_montant=869398.25, t2_montant=869398.25, t3_montant=869398.25, t4_montant=869398.25 WHERE code_budgetaire='ADM01' AND annee=2026;
UPDATE budget_adopte SET t1_montant=6446875, t2_montant=6446875, t3_montant=6446875, t4_montant=6446875 WHERE code_budgetaire='ADM02' AND annee=2026;
UPDATE budget_adopte SET t1_montant=202000, t2_montant=303000, t3_montant=303000, t4_montant=202000 WHERE code_budgetaire='ADM03' AND annee=2026;
UPDATE budget_adopte SET t1_montant=198000, t2_montant=99000, t3_montant=99000, t4_montant=99000 WHERE code_budgetaire='ADM04' AND annee=2026;
UPDATE budget_adopte SET t1_montant=7716273.25, t2_montant=7718273.25, t3_montant=7718273.25, t4_montant=7617273.25 WHERE code_budgetaire='ADM00' AND annee=2026;

UPDATE budget_adopte SET t1_montant=444000, t2_montant=666000, t3_montant=666000, t4_montant=444000 WHERE code_budgetaire='PRG01' AND annee=2026;
UPDATE budget_adopte SET t1_montant=1237000, t2_montant=1855500, t3_montant=1855500, t4_montant=1237000 WHERE code_budgetaire='PRG02' AND annee=2026;
UPDATE budget_adopte SET t1_montant=1595000, t2_montant=1595000, t3_montant=1595000, t4_montant=1595000 WHERE code_budgetaire='PRG03' AND annee=2026;
UPDATE budget_adopte SET t1_montant=1150500, t2_montant=1150500, t3_montant=767000, t4_montant=767000 WHERE code_budgetaire='PRG04' AND annee=2026;
UPDATE budget_adopte SET t1_montant=15000, t2_montant=15000, t3_montant=15000, t4_montant=15000 WHERE code_budgetaire='PRG05' AND annee=2026;
UPDATE budget_adopte SET t1_montant=4441500, t2_montant=5282000, t3_montant=4898500, t4_montant=4058000 WHERE code_budgetaire='PRG00' AND annee=2026;

UPDATE budget_adopte SET t1_montant=500000, t2_montant=500000, t3_montant=500000, t4_montant=500000 WHERE code_budgetaire='EXP01' AND annee=2026;
UPDATE budget_adopte SET t1_montant=227500, t2_montant=227500, t3_montant=227500, t4_montant=227500 WHERE code_budgetaire='EXP02' AND annee=2026;
UPDATE budget_adopte SET t1_montant=727500, t2_montant=727500, t3_montant=727500, t4_montant=727500 WHERE code_budgetaire='EXP00' AND annee=2026;

UPDATE budget_adopte SET t1_montant=267500, t2_montant=267500, t3_montant=267500, t4_montant=267500 WHERE code_budgetaire='DEV01' AND annee=2026;
UPDATE budget_adopte SET t1_montant=100000, t2_montant=100000, t3_montant=100000, t4_montant=100000 WHERE code_budgetaire='DEV02' AND annee=2026;
UPDATE budget_adopte SET t1_montant=15000, t2_montant=15000, t3_montant=15000, t4_montant=15000 WHERE code_budgetaire='DEV03' AND annee=2026;
UPDATE budget_adopte SET t1_montant=10000, t2_montant=10000, t3_montant=10000, t4_montant=10000 WHERE code_budgetaire='DEV04' AND annee=2026;
UPDATE budget_adopte SET t1_montant=392500, t2_montant=392500, t3_montant=392500, t4_montant=392500 WHERE code_budgetaire='DEV00' AND annee=2026;

UPDATE budget_adopte SET t1_montant=30000, t2_montant=30000, t3_montant=30000, t4_montant=30000 WHERE code_budgetaire='GOV01' AND annee=2026;
UPDATE budget_adopte SET t1_montant=50000, t2_montant=50000, t3_montant=50000, t4_montant=50000 WHERE code_budgetaire='GOV02' AND annee=2026;
UPDATE budget_adopte SET t1_montant=40000, t2_montant=40000, t3_montant=40000, t4_montant=40000 WHERE code_budgetaire='GOV03' AND annee=2026;
UPDATE budget_adopte SET t1_montant=120000, t2_montant=120000, t3_montant=120000, t4_montant=120000 WHERE code_budgetaire='GOV00' AND annee=2026;

UPDATE budget_adopte SET t1_montant=1438796.5, t2_montant=719398.25, t3_montant=719398.25, t4_montant=0 WHERE code_budgetaire='DET01' AND annee=2026;
UPDATE budget_adopte SET t1_montant=408075.75, t2_montant=408075.75, t3_montant=408075.75, t4_montant=408075.75 WHERE code_budgetaire='DET02' AND annee=2026;
