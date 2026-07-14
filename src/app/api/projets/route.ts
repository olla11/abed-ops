import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'

const ProjetSchema = z.object({
  nom:         s.nom,
  description: s.text,
  statut:      z.string().max(20).optional(),
  date_debut:  s.date,
  date_fin:    s.date,
  is_public:   z.boolean().optional(),
  espace_id:   z.string().uuid('espace_id invalide').nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  // RLS (projets_select / can_access_projet) filtre déjà : projets publics,
  // créés par l'utilisateur, où il a une tâche assignée, ou rattachés à un
  // espace dont il est membre.
  const { data, error } = await supabase
    .from('projets_internes')
    .select(`*, created_by_profile:profiles!projets_internes_created_by_fkey(nom, prenoms), activites(id, statut, assignee_id, parent_id)`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 20, window: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const v = validate(ProjetSchema, body)
  if ('error' in v) return v.error

  const { data, error } = await supabase.from('projets_internes').insert({
    nom: v.data.nom.trim(),
    description: v.data.description?.trim() || null,
    statut: v.data.statut ?? 'en_cours',
    date_debut: v.data.date_debut || null,
    date_fin: v.data.date_fin || null,
    is_public: v.data.is_public !== false,
    espace_id: v.data.espace_id || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
