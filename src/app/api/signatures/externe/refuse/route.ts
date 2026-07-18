import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyExternalSignerToken } from '@/lib/external-signer-token'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  const motif = typeof body?.motif === 'string' ? body.motif.trim() : ''
  if (motif.length < 10) {
    return NextResponse.json({ error: 'Le motif est obligatoire (minimum 10 caractères).' }, { status: 400 })
  }

  const payload = verifyExternalSignerToken(token)
  if (!payload) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 401 })

  const admin = createAdminClient()

  const { data: signataire } = await admin
    .from('signataires')
    .select('id, demande_id, email, nom_externe, signe')
    .eq('id', payload.signataireId)
    .single()
  if (!signataire || signataire.email !== payload.email) {
    return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })
  }
  if (signataire.signe) return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })

  const { data: demande } = await admin
    .from('demandes_signature')
    .select('id, titre, statut, createur_id')
    .eq('id', signataire.demande_id)
    .single()
  if (!demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (demande.statut !== 'en_attente') {
    return NextResponse.json({ error: 'Cette demande ne peut plus être refusée' }, { status: 400 })
  }

  const signerName = signataire.nom_externe || signataire.email || 'Un signataire externe'

  const { error: updSigErr } = await admin
    .from('signataires')
    .update({ refuse: true, refuse_le: new Date().toISOString(), refuse_motif: motif })
    .eq('id', signataire.id)
  if (updSigErr) return NextResponse.json({ error: 'Erreur lors du refus' }, { status: 500 })

  await admin.from('demandes_signature').update({ statut: 'refusee', updated_at: new Date().toISOString() }).eq('id', demande.id)

  await admin.from('notifications').insert({
    user_id: demande.createur_id,
    titre: 'Signature refusée',
    message: `${signerName} a refusé de signer « ${demande.titre} » : ${motif}`,
    lien: '/signatures',
  }).then(({ error: e }) => { if (e) console.error('[Signatures externe] Notif refus error:', e) })

  const { data: createur } = await admin.from('profiles').select('nom, prenoms, email').eq('id', demande.createur_id).single()
  if (createur?.email) {
    await sendEmail({
      to: createur.email,
      subject: `My ABED — Signature refusée : ${demande.titre}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#b91c1c;">My ABED — Signature refusée</h2>
          <p>Bonjour <strong>${createur.prenoms} ${createur.nom}</strong>,</p>
          <p><strong>${signerName}</strong> (signataire externe) a refusé de signer le document <strong>${demande.titre}</strong> et a laissé le commentaire suivant :</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;color:#991b1b;">${motif}</div>
          <p>Apportez les corrections nécessaires puis renvoyez le document corrigé depuis « Mes demandes ».</p>
          <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
            Voir la demande
          </a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
        </div>
      `,
    }).catch(err => console.error('[Signatures externe] Email refus error:', err))
  }

  return NextResponse.json({ ok: true })
}
