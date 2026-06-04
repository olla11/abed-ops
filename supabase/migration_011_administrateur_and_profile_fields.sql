-- Migration 011 : rôle administrateur + champs profil supplémentaires

-- 1. Ajouter le rôle 'administrateur' à l'enum si nécessaire
DO $$ BEGIN
  ALTER TYPE access_role ADD VALUE IF NOT EXISTS 'administrateur';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. S'assurer que la colonne role accepte la valeur 'administrateur'
-- (si le type est un VARCHAR/TEXT et non un enum, pas besoin)
-- Le profil utilise généralement TEXT pour role, donc on peut juste documenter ici.

-- 3. S'assurer que les colonnes adresse, date_naissance, lieu_naissance, nationalite existent
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS lieu_naissance TEXT,
  ADD COLUMN IF NOT EXISTS nationalite TEXT;

-- 4. La mise à jour du profil par l'utilisateur lui-même est déjà couverte par la politique RLS existante.
-- Vérifie que la politique UPDATE sur profiles autorise l'utilisateur à mettre à jour son propre profil.
-- Si aucune politique UPDATE n'existe :
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'user update own profile'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "user update own profile" ON public.profiles
        FOR UPDATE USING (id = auth.uid())
        WITH CHECK (id = auth.uid());
    $pol$;
  END IF;
END $$;
