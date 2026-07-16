import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { STATUT_TOUR, TdrStatut } from '@/lib/tdr'
import { notifyTdr } from '@/lib/tdr-notify'

const PROCHAIN_STATUT: Partial<Record<TdrStatut, TdrStatut>> = {
  en_validation_technique: 'en_validation_caf',
  en_validation_caf: 'en_autorisation_de',
  en_autorisation_de: 'actif',
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr } = await supabase.from('tdrs').select('*').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })

  const roleAttendu = STATUT_TOUR[tdr.statut as TdrStatut]
  if (!roleAttendu) {
    return NextResponse.json({ error: "Ce TDR n'attend pas de signature actuellement" }, { status: 409 })
  }

  const admin = createAdminClient()
  const { data: signataire } = await admin.from('tdr_signataires')
    .select('*').eq('tdr_id', id).eq('role', roleAttendu).single()

  if (!signataire || signataire.profile_id !== user.id) {
    return NextResponse.json({ error: "Ce n'est pas votre tour de signer ce TDR" }, { status: 403 })
  }

  await admin.from('tdr_signataires')
    .update({ statut: 'signe', signe_le: new Date().toISOString(), commentaire: null })
    .eq('id', signataire.id)

  const prochainStatut = PROCHAIN_STATUT[tdr.statut as TdrStatut]!
  const { error: upErr } = await admin.from('tdrs')
    .update({ statut: prochainStatut, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  if (prochainStatut === 'actif') {
    await notifyTdr(id, {
      titre: 'TDR validé et actif',
      message: `Le TDR « ${tdr.titre_activite} » (${tdr.numero}) est désormais actif et téléchargeable par tous.`,
      excludeId: user.id,
    }).catch(console.error)
  } else {
    const prochainRole = STATUT_TOUR[prochainStatut]!
    const { data: prochainSignataire } = await admin.from('tdr_signataires')
      .select('profile_id').eq('tdr_id', id).eq('role', prochainRole).single()

    await notifyTdr(id, {
      titre: 'TDR — validation suivante',
      message: `Le TDR « ${tdr.titre_activite} » (${tdr.numero}) a avancé à l'étape suivante de validation.`,
      actionPourId: prochainSignataire?.profile_id ?? undefined,
      messageAction: `Le TDR « ${tdr.titre_activite} » (${tdr.numero}) attend votre validation.`,
      excludeId: user.id,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true, statut: prochainStatut })
}
