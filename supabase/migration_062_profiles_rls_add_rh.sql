-- 'rh' pouvait déjà gérer le personnel (page /rh/*, via le client
-- service-role), mais n'était pas dans la liste des rôles autorisés à lire
-- tous les profils par RLS — ce qui cassait, pour un compte RH, tout
-- sélecteur de personnes utilisant le client authentifié normal
-- (GestionTitres, inscriptions en attente, Actions par lot...). Même
-- oubli que pour superadmin ailleurs dans l'appli.
ALTER POLICY "lire son profil ou tout si caf/de/admin" ON profiles
USING ((id = auth.uid()) OR ("current_role"() = ANY (ARRAY['caf'::user_role, 'de'::user_role, 'dp'::user_role, 'admin'::user_role, 'manager'::user_role, 'rh'::user_role, 'superadmin'::user_role])));
