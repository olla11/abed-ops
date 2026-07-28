-- Complète automatiquement, pour les profils existants, ce qui peut être
-- déduit de données déjà connues : genre depuis civilité, ville depuis
-- l'adresse, matricule séquentiel pour ceux qui n'en ont pas encore.

UPDATE profiles SET genre = CASE civilite WHEN 'M.' THEN 'M' WHEN 'Mme' THEN 'F' ELSE genre END
WHERE genre IS NULL AND civilite IN ('M.', 'Mme');

-- La ville est le premier segment de l'adresse ("Parakou, Bénin", "Cotonou,
-- quartier X..."), pas le dernier (souvent le pays ou un détail de quartier).
UPDATE profiles SET ville = trim(split_part(adresse, ',', 1))
WHERE ville IS NULL AND adresse IS NOT NULL AND position(',' in adresse) > 0;

DO $$
DECLARE
  r RECORD;
  next_num INT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(matricule, '^ABED-(\d+)$'))[1]::int), 0) INTO next_num
  FROM profiles WHERE matricule IS NOT NULL;

  FOR r IN SELECT id FROM profiles WHERE matricule IS NULL ORDER BY created_at LOOP
    next_num := next_num + 1;
    UPDATE profiles SET matricule = 'ABED-' || lpad(next_num::text, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;
