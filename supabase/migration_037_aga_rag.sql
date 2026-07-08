-- RAG pour l'assistant AGA : base vectorielle des documents de knowledge/
-- Remplace l'injection brute de tout le contenu des fichiers par une recherche
-- par similarité, qui ne renvoie que les passages pertinents à chaque question.

create extension if not exists vector;

create table if not exists public.aga_chunks (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  chunk_index int not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists aga_chunks_source_idx on public.aga_chunks(source);
create index if not exists aga_chunks_embedding_idx on public.aga_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.aga_chunks enable row level security;

-- Table utilisée uniquement côté serveur (indexation + recherche), aucun accès direct utilisateur.
grant select, insert, update, delete on public.aga_chunks to service_role;

create or replace function public.match_aga_chunks(query_embedding vector(768), match_count int default 6)
returns table (id uuid, source text, content text, similarity float)
language sql stable
as $$
  select id, source, content, 1 - (embedding <=> query_embedding) as similarity
  from public.aga_chunks
  order by embedding <=> query_embedding
  limit match_count
$$;

grant execute on function public.match_aga_chunks(vector, int) to service_role;

notify pgrst, 'reload schema';
