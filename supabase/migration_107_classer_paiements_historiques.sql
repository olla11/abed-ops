-- Affectation d'un code budgétaire aux 14 paiements historiques importés
-- (feuille Excel "PAIEMENT AUTORISE"), qui n'en portaient pas nativement.
-- Déduit du libellé de l'objet — PRG04 pour tout ce qui relève du
-- programme CLEE-2i/employabilité, ADM02 pour les honoraires/allocations
-- de personnel administratif, ADM01 pour les charges locatives (SBEE),
-- ADM03 pour la communication. DDP-2026-038 (restauration/eau pour une
-- mission de terrain "diagnostic des SAE") et DDP-2026-044 (allocation
-- personnelle) sont les deux affectations les moins certaines — à
-- reclasser si besoin depuis Pay Roll.
UPDATE pay_roll SET code_budgetaire = 'PRG04' WHERE reference IN ('DDP-2026-032','DDP-2026-035','DDP-2026-039','DDP-2026-045','DDP-2026-046','DDP-2026-047','DDP-2026-019');
UPDATE pay_roll SET code_budgetaire = 'ADM03' WHERE reference IN ('DDP-2026-037','DDP-2026-043');
UPDATE pay_roll SET code_budgetaire = 'ADM02' WHERE reference IN ('DDP-2026-040','DDP-2026-041','DDP-2026-044');
UPDATE pay_roll SET code_budgetaire = 'ADM01' WHERE reference = 'DDP-2026-042';
UPDATE pay_roll SET code_budgetaire = 'ADM02' WHERE reference = 'DDP-2026-038';

-- Répercuter sur le journal des dépenses déjà exécutées (Exécution
-- financière lit ce journal, pas Pay Roll directement).
UPDATE depenses_executees d SET code_budgetaire = p.code_budgetaire
FROM pay_roll p
WHERE d.pay_roll_id = p.id AND p.reference LIKE 'DDP-2026-%' AND p.code_budgetaire IS NOT NULL;
