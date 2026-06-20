import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.nom?.trim() || !body?.projet_id) {
    return NextResponse.json({ error: 'Nom et projet_id requis' }, { status: 400 })
  }

  const { data, error } = await supabase.from('activites').insert({
    projet_id: body.projet_id,
    nom: body.nom.trim(),
    description: body.description?.trim() || null,
    statut: body.statut ?? 'a_faire',
    priorite: body.priorite ?? 'normale',
    assignee_id: body.assignee_id || null,
    date_echeance: body.date_echeance || null,
    created_by: user.id,
  }).select(`*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms), created_by_profile:profiles!activites_created_by_fkey(id, nom, prenoms), commentaires_activites(id)`).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
