import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const update: Record<string, unknown> = {}
  if (body.nom !== undefined) update.nom = body.nom
  if (body.description !== undefined) update.description = body.description
  if (body.statut !== undefined) update.statut = body.statut
  if (body.priorite !== undefined) update.priorite = body.priorite
  if (body.assignee_id !== undefined) update.assignee_id = body.assignee_id
  if (body.date_echeance !== undefined) update.date_echeance = body.date_echeance

  const { data, error } = await supabase
    .from('activites').update(update).eq('id', params.id)
    .select(`*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms), created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms), commentaires_activites(id)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { error } = await supabase.from('activites').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
