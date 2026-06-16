-- Migration 034 : accorder les privilèges manquants sur les tables congés
-- (migration 024 avait créé les tables et la RLS mais oublié les GRANT,
-- ce qui bloquait silencieusement la lecture de types_conge côté client)

GRANT SELECT ON public.types_conge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.types_conge TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.conges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conges TO service_role;

GRANT SELECT ON public.soldes_conges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soldes_conges TO service_role;
