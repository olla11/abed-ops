-- Migration 017 : accorder DELETE/UPDATE manquants au service_role
-- À exécuter dans le SQL Editor Supabase

-- paiements_prestataires : migration 014 n'accordait que SELECT/INSERT
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paiements_prestataires TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paiements_prestataires TO service_role;

-- rapports_allocations : migration 015 n'accordait que SELECT/INSERT/UPDATE
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapports_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapports_allocations TO service_role;

-- demandes_paiement : migration 015 n'accordait que SELECT/INSERT/UPDATE
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_paiement TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_paiement TO service_role;

-- soumissions : vérifier que DELETE est accordé
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soumissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soumissions TO service_role;

-- alertes_envoyees : vérifier que DELETE est accordé
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertes_envoyees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertes_envoyees TO service_role;
