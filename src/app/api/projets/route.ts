import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.nom?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const { data, error } = await supabase.from('projets_internes').insert({
    nom: body.nom.trim(),
    description: body.description?.trim() || null,
    statut: body.statut ?? 'en_cours',
    date_debut: body.date_debut || null,
    date_fin: body.date_fin || null,
    is_public: body.is_public !== false,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
