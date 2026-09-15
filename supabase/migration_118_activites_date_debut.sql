-- Permet de choisir une plage de date (début → échéance) pour une tâche,
-- au lieu d'une seule date. date_echeance reste la date de fin (due date)
-- utilisée partout ailleurs (relances, tri, retard) ; date_debut est le
-- nouveau champ optionnel marquant le début de la plage.
ALTER TABLE activites ADD COLUMN date_debut date;
