-- Ajout des colonnes manquantes dans la table contrats
alter table contrats add column if not exists direction text;
alter table contrats add column if not exists salaire_brut numeric;
alter table contrats add column if not exists observations text;

-- Rafraîchir le cache du schéma Supabase
notify pgrst, 'reload schema';
