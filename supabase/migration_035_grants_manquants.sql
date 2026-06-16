-- GRANTs manquants sur contrats, demandes_signature et signataires
-- Ces tables ont été créées sans GRANT explicite, causant des retours vides silencieux.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_signature TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_signature TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signataires TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signataires TO service_role;

NOTIFY pgrst, 'reload schema';
