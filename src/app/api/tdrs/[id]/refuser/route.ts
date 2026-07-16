import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { STATUT_TOUR, TdrStatut } from '@/lib/tdr'
import { notifyTdr } from '@/lib/tdr-notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const commentaire = (body?.commentaire ?? '').trim()
  if (!commentaire) return NextResponse.json({ error: 'Un motif de refus est requis' }, { status: 400 })

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
    return NextResponse.json({ error: "Ce n'est pas votre tour sur ce TDR" }, { status: 403 })
  }

  await admin.from('tdr_signataires')
    .update({ statut: 'refuse', signe_le: new Date().toISOString(), commentaire })
    .eq('id', signataire.id)

  const { error: upErr } = await admin.from('tdrs').update({
    statut: 'brouillon',
    dernier_refus_par: user.id,
    dernier_refus_commentaire: commentaire,
    dernier_refus_le: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  await notifyTdr(id, {
    titre: 'TDR refusé — révision nécessaire',
    message: `Le TDR « ${tdr.titre_activite} » a été refusé. Motif : ${commentaire}`,
    actionPourId: tdr.initiateur_id,
    messageAction: `Votre TDR « ${tdr.titre_activite} » a été refusé. Motif : ${commentaire}`,
    excludeId: user.id,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
