-- Migration 075 : suivi de notification par signataire, pour la signature dans l'ordre choisi

ALTER TABLE signataires
  ADD COLUMN IF NOT EXISTS notifie boolean NOT NULL DEFAULT false;

-- Les signataires déjà notifiés avant cette migration (toute demande en
-- attente jusqu'ici notifiait tout le monde en même temps) sont marqués
-- comme déjà notifiés pour ne pas leur renvoyer un email en double.
UPDATE signataires SET notifie = true WHERE signe = true OR est_observateur = false;
