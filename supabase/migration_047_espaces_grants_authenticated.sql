-- Migration 047 : GRANTs manquants sur espaces/espace_membres pour le rôle
-- `authenticated`. migration_040/041 n'accordaient les privilèges qu'à
-- service_role — passé inaperçu tant que les routes API utilisaient le
-- client admin, mais bloquant désormais que migration_046 les fait utiliser
-- le client authentifié standard (pour que la RLS s'applique réellement).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.espaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.espace_membres TO authenticated;

NOTIFY pgrst, 'reload schema';
