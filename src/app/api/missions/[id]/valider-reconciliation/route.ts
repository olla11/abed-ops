import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server'
import { notifyMissionUser, notifyMissionByRole } from '@/lib/mission-notify'

// POST /api/missions/[id]/valider-reconciliation
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
  if (!profile || !['caf', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accès réservé à la CAF' }, { status: 403 })
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
    .select(`
      *,
      missionnaire:profiles!missions_missionnaire_id_fkey(id, nom, prenoms, email)
    `)
    .eq('id', id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.status !== 'reconciliation_caf') {
    return NextResponse.json({ error: 'Cette mission n\'est pas en attente de validation CAF' }, { status: 400 })
  }

  if (action === 'rejeter') {
    await admin.from('missions').update({
      status: 'reconciliation',
      reconciliation_commentaire: commentaire,
    }).eq('id', id)

    // Notifier le missionnaire
    await notifyMissionUser(admin, {
      userId: mission.missionnaire_id,
      missionId: id,
      titre: 'Réconciliation rejetée — à corriger',
      message: `Votre réconciliation pour la mission ${mission.reference ?? ''} a été rejetée par la CAF. Commentaire : ${commentaire}`,
      lien: `/missions/${id}/reconciliation`,
    })

    return NextResponse.json({ ok: true, status: 'reconciliation' })
  }

  // Valider : transmettre au DE pour autorisation finale
  await admin.from('missions').update({
    status: 'reconciliation_de',
    reconciliation_commentaire: null,
  }).eq('id', id)

  // Notifier le missionnaire
  await notifyMissionUser(admin, {
    userId: mission.missionnaire_id,
    missionId: id,
    titre: 'Réconciliation validée par la CAF',
    message: `Votre réconciliation pour la mission ${mission.reference ?? ''} a été validée par la CAF et est en attente d'autorisation du Directeur Exécutif.`,
  })

  // Notifier le DE
  await notifyMissionByRole(admin, {
    roles: ['de', 'admin'],
    missionId: id,
    excludeId: user.id,
    titre: `Réconciliation à autoriser — Mission ${mission.reference ?? id}`,
    message: `La réconciliation de la mission « ${mission.objet} » a été validée par la CAF et attend votre autorisation finale.`,
  })

  return NextResponse.json({ ok: true, status: 'reconciliation_de' })
}
