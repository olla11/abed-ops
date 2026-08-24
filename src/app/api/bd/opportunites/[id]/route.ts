import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estBD } from '@/lib/roles'
import { notifierAssignationBD } from '@/lib/bd-notify'

const CHAMPS_MODIFIABLES = [
  'titre', 'bailleur', 'description_appel', 'type_opportunite', 'responsable_id', 'associes_ids',
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

  // Lu AVANT la mise à jour pour ne notifier que les personnes nouvellement
  // désignées (comparaison avant/après), pas celles déjà en place.
  const { data: avant } = await supabase
    .from('opportunites_bd').select('responsable_id, associes_ids, titre, bailleur, date_limite').eq('id', id).single()

  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const champ of CHAMPS_MODIFIABLES) {
    if (champ in body) update[champ] = body[champ]
  }

  const { error } = await supabase.from('opportunites_bd').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (avant && ('responsable_id' in update || 'associes_ids' in update)) {
    const nouveauResponsable = 'responsable_id' in update ? (update.responsable_id as string | null) : avant.responsable_id
    const responsableEstNouveau = nouveauResponsable && nouveauResponsable !== avant.responsable_id
    const nouveauxAssocies = 'associes_ids' in update
      ? ((update.associes_ids as string[] | undefined) ?? []).filter(uid => !(avant.associes_ids ?? []).includes(uid))
      : []

    const admin = createAdminClient()
    await notifierAssignationBD(admin, {
      opportuniteId: id,
      titreOpportunite: (update.titre as string | undefined) ?? avant.titre,
      bailleur: 'bailleur' in update ? (update.bailleur as string | null) : avant.bailleur,
      dateLimite: 'date_limite' in update ? (update.date_limite as string | null) : avant.date_limite,
      responsableId: responsableEstNouveau ? nouveauResponsable : null,
      nouveauxAssocies,
    }).catch(e => console.error('[bd/opportunites PATCH] notif error:', e))
  }

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
