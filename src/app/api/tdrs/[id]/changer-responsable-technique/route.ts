import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { notifyTdr } from '@/lib/tdr-notify'

/**
 * Permet à l'initiateur de changer le responsable technique assigné à un TDR
 * à tout moment — y compris après que ce dernier ait déjà signé. Dans ce cas,
 * la validation technique est remise à zéro et le TDR repasse en attente de
 * validation par la nouvelle personne assignée ; les visas déjà obtenus plus
 * loin dans le circuit (CAF, DE) sont eux aussi réinitialisés puisqu'ils
 * reposaient sur une validation technique désormais caduque.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr } = await supabase.from('tdrs').select('*').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })
  if (tdr.initiateur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const responsableTechniqueId = body?.responsable_technique_id
  if (!responsableTechniqueId) {
    return NextResponse.json({ error: 'Responsable technique requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: nouveauProfil } = await admin.from('profiles').select('id, nom, prenoms').eq('id', responsableTechniqueId).single()
  if (!nouveauProfil) return NextResponse.json({ error: 'Personne introuvable' }, { status: 404 })

  if (tdr.responsable_technique_id === responsableTechniqueId) {
    return NextResponse.json({ error: 'Cette personne est déjà responsable technique de ce TDR' }, { status: 409 })
  }

  // En brouillon, aucune validation n'est en cours : on se contente de
  // changer l'assignation, elle sera reprise telle quelle à la prochaine
  // soumission (voir soumettre/route.ts).
  const dejaEnCircuit = tdr.statut !== 'brouillon'

  const { error: upErr } = await admin.from('tdrs').update({
    responsable_technique_id: responsableTechniqueId,
    ...(dejaEnCircuit ? { statut: 'en_validation_technique' } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  if (dejaEnCircuit) {
    // Réassigné + remis en attente pour la nouvelle personne.
    await admin.from('tdr_signataires').upsert({
      tdr_id: id, role: 'responsable_technique', profile_id: responsableTechniqueId, ordre: 2,
      statut: 'en_attente', signe_le: null, commentaire: null,
    }, { onConflict: 'tdr_id,role' })

    // Les visas obtenus plus loin dans le circuit (CAF, DE) reposaient sur
    // une validation technique désormais remplacée — à reconfirmer.
    await admin.from('tdr_signataires').update({ statut: 'en_attente', signe_le: null, commentaire: null })
      .eq('tdr_id', id).in('role', ['caf', 'de'])
  }

  await notifyTdr(id, {
    titre: dejaEnCircuit ? 'TDR — nouveau responsable technique assigné' : 'TDR — responsable technique modifié',
    message: `${nouveauProfil.prenoms} ${nouveauProfil.nom} a été assigné(e) comme responsable technique du TDR « ${tdr.titre_activite} »${dejaEnCircuit ? ' — la validation technique est à reconfirmer' : ''}.`,
    actionPourId: dejaEnCircuit ? responsableTechniqueId : undefined,
    messageAction: `Le TDR « ${tdr.titre_activite} » vous a été transmis pour validation technique.`,
    excludeId: user.id,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
