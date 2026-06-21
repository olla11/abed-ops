-- Add parent_id to activites for sub-task support
ALTER TABLE activites ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES activites(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS activites_parent_id_idx ON activites(parent_id);
