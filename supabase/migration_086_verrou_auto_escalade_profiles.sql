-- Migration 086 : ferme la faille d'auto-escalade la plus critique trouvée
-- à ce jour — les correctifs des migrations 084/085 (RPC attribuer_titre /
-- attribuer_role) ne servaient à rien face à ce chemin, bien plus direct.
--
-- Les policies RLS UPDATE sur profiles ("modifier son profil" et "user
-- update own profile") vérifient uniquement que la ligne modifiée est bien
-- celle de l'appelant (id = auth.uid()) — RIEN ne restreint QUELLES colonnes
-- peuvent changer. N'importe quel compte connecté (missionnaire compris)
-- pouvait donc, avec le client Supabase standard déjà utilisé partout dans
-- l'app (aucune RPC, aucun outil spécial requis), faire :
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', monId)
--
-- Vérifié en base (transaction annulée avant tout enregistrement) : la
-- mise à jour vers 'admin' est acceptée sans aucun blocage ; seule une
-- tentative vers 'superadmin' échoue, et uniquement à cause d'un index
-- unique empêchant deux superadmin simultanés — pas d'une règle de sécurité.
-- Le même trou ouvrait aussi l'auto-activation (registration_status) et
-- l'auto-désarchivage (archived).
--
-- Correctif : un trigger BEFORE UPDATE qui, quand un compte modifie SA
-- PROPRE ligne (et n'est pas déjà admin/superadmin), fige role,
-- registration_status, archived et archived_at/archived_reason à leur
-- valeur précédente. N'affecte pas les mises à jour d'AUTRES comptes
-- (celles des RPC attribuer_titre/attribuer_role ou des routes API
-- admin en service_role, qui ciblent toujours la ligne de quelqu'un
-- d'autre et restent inchangées).

CREATE OR REPLACE FUNCTION public.proteger_colonnes_sensibles_profil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Seul l'auto-service (l'utilisateur modifie sa propre ligne) est concerné —
  -- les mises à jour d'un AUTRE compte (RPC dédiées, routes admin en
  -- service_role) ciblent toujours une ligne où OLD.id <> auth.uid() et ne
  -- passent donc jamais par cette branche.
  IF OLD.id = auth.uid() AND OLD.role NOT IN ('admin', 'superadmin') THEN
    NEW.role                := OLD.role;
    NEW.registration_status := OLD.registration_status;
    NEW.archived             := OLD.archived;
    NEW.archived_at          := OLD.archived_at;
    NEW.archived_reason      := OLD.archived_reason;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_colonnes_sensibles_profil ON public.profiles;
CREATE TRIGGER trg_proteger_colonnes_sensibles_profil
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_colonnes_sensibles_profil();
