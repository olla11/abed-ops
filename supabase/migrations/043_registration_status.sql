-- Add registration_status to track self-registered users awaiting activation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_status text
  CHECK (registration_status IN ('pending_email', 'pending_activation'));

-- NULL means account is fully active (admin-created or already activated)
