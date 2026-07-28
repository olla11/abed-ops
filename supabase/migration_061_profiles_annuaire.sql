-- Annuaire minimal du personnel, visible par tous les utilisateurs connectés
-- (id, nom, prénoms, civilité, rôle, fonction, direction — rien de sensible :
-- pas de téléphone, adresse, date de naissance, IFU, etc.). Nécessaire pour
-- les sélecteurs "choisir une personne" (responsable technique d'un TDR,
-- collaborateurs, etc.) : la table profiles elle-même reste verrouillée par
-- RLS à caf/de/dp/admin/manager/superadmin, donc une vue dédiée qui
-- s'exécute avec les droits de son propriétaire (pas ceux de l'appelant)
-- est le moyen le plus sûr d'exposer juste ce qu'il faut à tout le monde.
CREATE VIEW public.profiles_annuaire WITH (security_invoker = false) AS
SELECT id, nom, prenoms, civilite, role, fonction, direction, archived
FROM public.profiles;

GRANT SELECT ON public.profiles_annuaire TO authenticated;
