import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { chapitresValides } from '@/lib/tdr'
import { notifyTdr } from '@/lib/tdr-notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr } = await supabase.from('tdrs').select('*').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })
  if (tdr.initiateur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (tdr.statut !== 'brouillon') {
    return NextResponse.json({ error: 'Ce TDR a déjà été transmis pour signature' }, { status: 409 })
  }
  if (!chapitresValides(tdr.chapitres)) {
    return NextResponse.json({ error: 'Les 8 chapitres du TDR sont obligatoires' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const responsableTechniqueId = body?.responsable_technique_id
  if (!responsableTechniqueId) {
    return NextResponse.json({ error: 'Responsable technique requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: caf } = await admin.from('tdr_signataires').select('profile_id').eq('tdr_id', id).eq('role', 'caf').single()
  const { data: de } = await admin.from('tdr_signataires').select('profile_id').eq('tdr_id', id).eq('role', 'de').single()
  if (!caf?.profile_id) return NextResponse.json({ error: 'Aucun CAF configuré dans le système' }, { status: 409 })
  if (!de?.profile_id) return NextResponse.json({ error: 'Aucun Directeur Exécutif configuré dans le système' }, { status: 409 })

  // Numéro attribué une seule fois, au premier envoi (pas de trou de numérotation pour les brouillons abandonnés).
  let numero = tdr.numero
  if (!numero) {
    const year = new Date().getFullYear()
    const { count } = await admin.from('tdrs')
      .select('id', { count: 'exact', head: true })
      .not('numero', 'is', null)
      .gte('created_at', `${year}-01-01`)
      .lt('created_at', `${year + 1}-01-01`)
    numero = `${String((count ?? 0) + 1).padStart(3, '0')}-${year}/ABED/DE/DP/`
  }

  const { error: upErr } = await admin.from('tdrs').update({
    responsable_technique_id: responsableTechniqueId,
    statut: 'en_validation_technique',
    numero,
    dernier_refus_par: null,
    dernier_refus_commentaire: null,
    dernier_refus_le: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Signataires : initiateur marqué signé, responsable technique (re)créé,
  // caf/de remis à zéro (utile en cas de nouvelle soumission après refus).
  await admin.from('tdr_signataires').update({ statut: 'signe', signe_le: new Date().toISOString(), commentaire: null })
    .eq('tdr_id', id).eq('role', 'initiateur')

  await admin.from('tdr_signataires').upsert({
    tdr_id: id, role: 'responsable_technique', profile_id: responsableTechniqueId, ordre: 2,
    statut: 'en_attente', signe_le: null, commentaire: null,
  }, { onConflict: 'tdr_id,role' })

  await admin.from('tdr_signataires').update({ statut: 'en_attente', signe_le: null, commentaire: null })
    .eq('tdr_id', id).in('role', ['caf', 'de'])

  await notifyTdr(id, {
    titre: 'TDR transmis pour validation technique',
    message: `Le TDR « ${tdr.titre_activite} » (${numero}) a été transmis pour validation technique.`,
    actionPourId: responsableTechniqueId,
    messageAction: `Le TDR « ${tdr.titre_activite} » (${numero}) vous a été transmis pour validation technique.`,
    excludeId: user.id,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
