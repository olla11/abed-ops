-- Centre de préférences opt-in : sujets sur lesquels un utilisateur accepte
-- de recevoir des communications ciblées (annonces internes). Choix libre,
-- révocable à tout moment depuis son propre profil — jamais requis à
-- l'inscription, jamais lié à l'accès aux fonctions RH/métier de l'appli.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_topics text[] NOT NULL DEFAULT '{}';

-- Historique des communications ciblées envoyées par l'administration
-- (email et/ou notification in-app), pour traçabilité — qui a envoyé quoi,
-- à combien de destinataires, quand.
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sujet text NOT NULL,
  corps text NOT NULL,
  canaux text[] NOT NULL DEFAULT '{}',
  destinataires_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_admin" ON announcements FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'rh', 'caf', 'superadmin'))
);
CREATE POLICY "announcements_insert_admin" ON announcements FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'rh', 'caf', 'superadmin'))
  AND sender_id = auth.uid()
);

GRANT SELECT, INSERT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
