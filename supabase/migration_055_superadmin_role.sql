-- Rôle superadmin : accès exclusif au journal d'audit et à la vue détaillée
-- des comptes utilisateurs. Ajouté séparément (avant la table audit_log) car
-- PostgreSQL interdit d'utiliser une nouvelle valeur d'enum dans la même
-- transaction/migration que celle qui l'ajoute.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';
