import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyContratExterneToken } from '@/lib/contrat-externe-token'
import { sendEmail } from '@/lib/resend'
import { revalidateTag } from 'next/cache'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.app'

// Refus (ou commentaire) du destinataire externe — même effet que
// /api/contrats/[id]/refuser-employe, authentifié par jeton signé.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = body?.token ?? ''
  const motif = (body?.motif ?? '').trim()
  if (motif.length < 10) return NextResponse.json({ error: 'Le motif est obligatoire (minimum 10 caractères).' }, { status: 400 })

  const payload = verifyContratExterneToken(token)
  if (!payload) return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: contrat } = await admin.from('contrats').select('*').eq('id', payload.contratId).single()
  if (!contrat || contrat.destinataire_email?.toLowerCase() !== payload.email.toLowerCase()) {
    return NextResponse.json({ error: 'Lien invalide.' }, { status: 401 })
  }
  if (contrat.profile_id) {
    return NextResponse.json({ error: 'Ce document est désormais rattaché à un compte My ABED. Connectez-vous pour y répondre.' }, { status: 409 })
  }
  if (contrat.workflow_statut !== 'envoye_employe') {
    return NextResponse.json({ error: 'Ce document ne peut pas être renvoyé à cette étape.' }, { status: 400 })
  }

  const { error: updErr } = await admin.from('contrats').update({
    workflow_statut: 'rejete_employe',
    commentaires_employe: motif,
  }).eq('id', contrat.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const nomDestinataire = `${contrat.destinataire_prenoms ?? ''} ${contrat.destinataire_nom ?? ''}`.trim() || contrat.destinataire_email
  const ref = contrat.numero ?? contrat.id

  const { data: rhs } = await admin.from('profiles').select('id, email, prenoms').in('role', ['rh', 'admin', 'caf'])
  for (const rh of rhs ?? []) {
    await admin.from('notifications').insert({
      user_id: rh.id,
      titre: 'Document renvoyé sans signature',
      message: `${nomDestinataire} a renvoyé son ${contrat.categorie_document ?? 'document'} (réf. ${ref}) sans signer, via le lien externe. Motif : ${motif}`,
      lien: '/rh/contrats',
    })
    if (rh.email) {
      try {
        await sendEmail({
          to: rh.email,
          subject: `[My ABED] Document renvoyé sans signature — ${nomDestinataire}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#b45309;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">My ABED — Document renvoyé sans signature</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour <strong>${rh.prenoms ?? ''}</strong>,</p>
    <p style="font-size:14px;color:#374151;"><strong>${nomDestinataire}</strong> (${contrat.destinataire_email}) a renvoyé son ${contrat.categorie_document ?? 'document'} (réf. ${ref}) sans le signer, via le lien externe.</p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:16px 0;">
      <strong>Motif :</strong> ${motif}
    </div>
    <a href="${APP_URL}/rh/contrats" style="display:inline-block;background:#064e3b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
      Gérer les contrats →
    </a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
        })
      } catch (e) { console.error('[contrats externe refuse] email RH:', e) }
    }
  }

  revalidateTag('contrats')
  return NextResponse.json({ ok: true, workflow_statut: 'rejete_employe' })
}
