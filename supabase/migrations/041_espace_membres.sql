CREATE TABLE IF NOT EXISTS espace_membres (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  espace_id uuid NOT NULL REFERENCES espaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(espace_id, profile_id)
);

ALTER TABLE espace_membres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "espace_membres_select" ON espace_membres FOR SELECT TO authenticated USING (true);
CREATE POLICY "espace_membres_insert" ON espace_membres FOR INSERT TO authenticated WITH CHECK (
  invited_by = auth.uid() AND
  EXISTS (SELECT 1 FROM espaces WHERE id = espace_id AND created_by = auth.uid())
);
CREATE POLICY "espace_membres_delete" ON espace_membres FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM espaces WHERE id = espace_id AND created_by = auth.uid())
);
GRANT ALL ON espace_membres TO service_role;

-- Auto-insert creator as member when espace is created (via trigger)
CREATE OR REPLACE FUNCTION add_espace_creator_as_membre()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO espace_membres (espace_id, profile_id, invited_by)
  VALUES (NEW.id, NEW.created_by, NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER espace_creator_membre
  AFTER INSERT ON espaces
  FOR EACH ROW EXECUTE FUNCTION add_espace_creator_as_membre();
