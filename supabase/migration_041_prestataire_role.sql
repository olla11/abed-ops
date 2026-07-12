-- Migration 041 : ajoute le rôle 'prestataire' à l'enum user_role
-- (utilisé par l'écran d'activation des comptes en attente, admin/inscriptions)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'prestataire';
