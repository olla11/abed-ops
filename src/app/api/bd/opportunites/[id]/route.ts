import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { estBD } from '@/lib/roles'

const CHAMPS_MODIFIABLES = [
  'titre', 'bailleur', 'description_appel', 'personnes_associees',
  'date_identification', 'date_publication', 'date_limite', 'date_soumission',
  'description_proposition', 'commentaires', 'observations', 'statut',
  'montant_demande', 'montant_obtenu', 'pieces_jointes',
] as const

// PATCH /api/bd/opportunites/[id] — met à jour les champs fournis. Le DE
// (lecture seule) n'a jamais accès à cette route côté UI ; la RLS
// (opportunites_bd_update) le bloquerait de toute façon s'il essayait.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('titre, role').eq('id', user.id).single()
  if (!profile || !(estBD(profile.titre) || ['admin', 'superadmin'].includes(profile.role))) {
    return NextResponse.json({ error: 'Accès réservé à l\'équipe Business Developer' }, { status: 403 })
  }

  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const champ of CHAMPS_MODIFIABLES) {
    if (champ in body) update[champ] = body[champ]
  }

  const { error } = await supabase.from('opportunites_bd').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/bd/opportunites/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('titre, role').eq('id', user.id).single()
  if (!profile || !(estBD(profile.titre) || ['admin', 'superadmin'].includes(profile.role))) {
    return NextResponse.json({ error: 'Accès réservé à l\'équipe Business Developer' }, { status: 403 })
  }

  const { error } = await supabase.from('opportunites_bd').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
