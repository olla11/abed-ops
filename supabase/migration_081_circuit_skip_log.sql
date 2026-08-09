-- Journal des étapes de circuit sautées automatiquement faute de compte actif
-- pour le rôle requis (voir src/lib/circuit-vacancy.ts). Permet la traçabilité
-- ("visible mais pas caché") sans bloquer les circuits de validation quand un
-- rôle clé (AAF, CAF, DE, RH...) n'a personne pour l'occuper.
CREATE TABLE IF NOT EXISTS circuit_skip_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit text NOT NULL,
  entity_id uuid NOT NULL,
  entity_label text,
  role_vacant text NOT NULL,
  status_from text NOT NULL,
  status_to text NOT NULL,
  skipped_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circuit_skip_log_skipped_at ON circuit_skip_log(skipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_circuit_skip_log_entity ON circuit_skip_log(circuit, entity_id);

ALTER TABLE circuit_skip_log ENABLE ROW LEVEL SECURITY;

-- Consultation réservée aux admin/superadmin ; écriture uniquement via le
-- client service-role (voir logAndNotifySkip).
CREATE POLICY "circuit_skip_log_select" ON circuit_skip_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin'))
);
