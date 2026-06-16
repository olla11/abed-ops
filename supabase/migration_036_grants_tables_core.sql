-- GRANTs manquants sur les tables fondamentales du schéma principal
-- Sans ces GRANTs, les requêtes via le client anon (Server Components, composants client)
-- retournent silencieusement vide, et les vérifications de rôle basées sur profiles.role échouent.

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.missions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO service_role;

GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.timesheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timesheets TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

GRANT SELECT ON public.parametres TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametres TO service_role;

NOTIFY pgrst, 'reload schema';
