-- Journal des sessions d'impersonation ("Se connecter en tant que") — trace
-- qui a réellement pris le contrôle du compte de qui, et quand, pour audit.
-- Ecriture uniquement via le client service-role (routes /api/admin/impersonate).
CREATE TABLE IF NOT EXISTS impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  admin_nom text,
  admin_prenoms text,
  target_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_nom text,
  target_prenoms text,
  target_role text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip text
);

CREATE INDEX IF NOT EXISTS idx_impersonation_log_admin ON impersonation_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_log_started ON impersonation_log(started_at DESC);

ALTER TABLE impersonation_log ENABLE ROW LEVEL SECURITY;

-- Seuls les superadmin peuvent consulter le journal ; les écritures se font
-- exclusivement via le client service-role (aucune policy INSERT/UPDATE
-- pour les utilisateurs authentifiés).
CREATE POLICY "impersonation_log_select" ON impersonation_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
);
