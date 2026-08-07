import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server'
import { notifyMissionUser, notifyMissionByRole } from '@/lib/mission-notify'
import { estAAF } from '@/lib/roles'

// POST /api/missions/[id]/valider-reconciliation-aaf
// body: { action: 'valider' | 'rejeter', commentaire?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()
  if (!profile || !(estAAF(profile.role) || profile.role === 'admin')) {
    return NextResponse.json({ error: 'Accès réservé à l\'AAF' }, { status: 403 })
  }

  const { action, commentaire } = await req.json()
  if (!['valider', 'rejeter'].includes(action)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }
  if (action === 'rejeter' && !commentaire?.trim()) {
    return NextResponse.json({ error: 'Un commentaire est requis pour le rejet' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: mission } = await admin
    .from('missions')
    .select('*')
    .eq('id', id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.status !== 'reconciliation_aaf') {
    return NextResponse.json({ error: 'Cette mission n\'est pas en attente de validation AAF' }, { status: 400 })
  }

  if (action === 'rejeter') {
    await admin.from('missions').update({
      status: 'reconciliation',
      reconciliation_commentaire: commentaire,
    }).eq('id', id)

    await notifyMissionUser(admin, {
      userId: mission.missionnaire_id,
      missionId: id,
      titre: 'Réconciliation rejetée — à corriger',
      message: `Votre réconciliation pour la mission ${mission.reference ?? ''} a été rejetée par l'AAF. Commentaire : ${commentaire}`,
      lien: `/missions/${id}/reconciliation`,
    })

    return NextResponse.json({ ok: true, status: 'reconciliation' })
  }

  // Valider : transmettre à la CAF pour validation finale
  await admin.from('missions').update({
    status: 'reconciliation_caf',
    reconciliation_commentaire: null,
  }).eq('id', id)

  await notifyMissionByRole(admin, {
    roles: ['caf', 'admin'],
    missionId: id,
    excludeId: user.id,
    titre: `Réconciliation à valider — Mission ${mission.reference ?? id}`,
    message: `La réconciliation de la mission « ${mission.objet} » a été validée par l'AAF et est soumise pour validation finale CAF.`,
  })

  return NextResponse.json({ ok: true, status: 'reconciliation_caf' })
}
