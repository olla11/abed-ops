import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('projets_internes')
    .select(`
      *,
      created_by_profile:profiles!projets_internes_created_by_fkey(id, nom, prenoms),
      activites(
        *,
        assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms),
        created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms),
        commentaires_activites(id)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { data, error } = await supabase
    .from('projets_internes')
    .update({
      ...(body.nom && { nom: body.nom.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.statut && { statut: body.statut }),
      ...(body.date_debut !== undefined && { date_debut: body.date_debut }),
      ...(body.date_fin !== undefined && { date_fin: body.date_fin }),
    })
    .eq('id', params.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { error } = await supabase.from('projets_internes').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
