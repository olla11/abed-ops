-- Migration 016 : Ajout du type d'emploi CDI
-- À exécuter en deux étapes dans Supabase SQL Editor

-- Étape 1 (seule dans un premier run) :
ALTER TYPE type_emploi ADD VALUE IF NOT EXISTS 'cdi';
