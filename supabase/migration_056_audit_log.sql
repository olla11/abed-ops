-- Journal d'audit : trace toutes les requêtes des utilisateurs connectés
-- (navigation comprise), écrit depuis le middleware via un insert non
-- bloquant (waitUntil). Lecture réservée au rôle superadmin.
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_nom text,
  actor_prenoms text,
  actor_role text,
  method text NOT NULL,
  path text NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_path ON audit_log(path);

-- Un seul compte peut porter le rôle superadmin à la fois : index unique
-- partiel sur une expression constante, filtré aux lignes superadmin — une
-- deuxième ligne correspondante violerait l'unicité.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_superadmin ON profiles ((true)) WHERE role = 'superadmin';

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_superadmin" ON audit_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
);
CREATE POLICY "audit_log_insert_self" ON audit_log FOR INSERT TO authenticated WITH CHECK (
  actor_id = auth.uid()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
