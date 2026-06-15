create table if not exists demandes_signature (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  fichier_url text,
  createur_id uuid references profiles(id) on delete cascade not null,
  statut text not null default 'en_attente', -- en_attente | complete
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists signataires (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes_signature(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  signe boolean not null default false,
  signe_le timestamptz,
  ordre int default 0,
  unique(demande_id, profile_id)
);

-- RLS
alter table demandes_signature enable row level security;
alter table signataires enable row level security;

create policy "auth users can read all demandes" on demandes_signature for select using (auth.uid() is not null);
create policy "auth users can insert demandes" on demandes_signature for insert with check (auth.uid() = createur_id);
create policy "createur can update" on demandes_signature for update using (auth.uid() = createur_id);

create policy "auth users can read signataires" on signataires for select using (auth.uid() is not null);
create policy "createur can insert signataires" on signataires for insert with check (
  auth.uid() = (select createur_id from demandes_signature where id = demande_id)
);
create policy "signataire can update own" on signataires for update using (auth.uid() = profile_id);
