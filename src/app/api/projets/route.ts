import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
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

  const admin = createAdminClient()

  // Public projects + projects created by user
  const { data: ownAndPublic, error: e1 } = await admin
    .from('projets_internes')
    .select(`*, created_by_profile:profiles!projets_internes_created_by_fkey(nom, prenoms), activites(id, statut, assignee_id, parent_id)`)
    .or(`is_public.eq.true,created_by.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // Private projects where user has a task assigned (not already included above)
  const { data: assignedActivites } = await admin
    .from('activites')
    .select('projet_id')
    .eq('assignee_id', user.id)

  const assignedProjectIds = [...new Set((assignedActivites ?? []).map(a => a.projet_id))]
  const alreadyIncluded = new Set((ownAndPublic ?? []).map(p => p.id))
  const missingIds = assignedProjectIds.filter(id => !alreadyIncluded.has(id))

  let extra: typeof ownAndPublic = []
  if (missingIds.length > 0) {
    const { data: extraProjects } = await admin
      .from('projets_internes')
      .select(`*, created_by_profile:profiles!projets_internes_created_by_fkey(nom, prenoms), activites(id, statut, assignee_id, parent_id)`)
      .in('id', missingIds)
      .eq('is_public', false)
    extra = extraProjects ?? []
  }

  const data = [...(ownAndPublic ?? []), ...extra]
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
