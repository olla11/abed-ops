-- Migration 004 : champs OM officiels ABED + informations personnelles profil
-- A executer dans Supabase Dashboard > SQL Editor

-- ===== PROFILS : informations personnelles =====
alter table public.profiles
  add column if not exists ifu             text,
  add column if not exists grade_indice    text,
  add column if not exists adresse         text,
  add column if not exists date_naissance  date,
  add column if not exists lieu_naissance  text,
  add column if not exists nationalite     text default 'Beninoise';

-- ===== MISSIONS : champs OM officiel =====
alter table public.missions
  add column if not exists conducteur_a_bord        text,
  add column if not exists date_arrivee_destination  date,
  add column if not exists date_depart_destination   date;