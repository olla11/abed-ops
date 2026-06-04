-- Migration 011 : champs profil complémentaires + politique RLS
-- Le rôle 'administrateur' est stocké en TEXT (pas d'enum à modifier).

-- 1. Colonnes manquantes sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS lieu_naissance TEXT,
  ADD COLUMN IF NOT EXISTS nationalite TEXT;

-- 2. Politique UPDATE si elle n'existe pas encore
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'user update own profile'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "user update own profile" ON public.profiles
        FOR UPDATE USING (id = auth.uid())
        WITH CHECK (id = auth.uid());
    $pol$;
  END IF;
END $$;
