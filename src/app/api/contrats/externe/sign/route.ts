import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyContratExterneToken } from '@/lib/contrat-externe-token'
import { sendEmail } from '@/lib/resend'
import { revalidateTag } from 'next/cache'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.app'

// Signature du destinataire externe (sans compte) — même effet que
// /api/contrats/[id]/signer-employe, mais authentifié par jeton signé au
// lieu d'une session applicative.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = body?.token ?? ''
  const payload = verifyContratExterneToken(token)
  if (!payload) return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: contrat } = await admin.from('contrats').select('*').eq('id', payload.contratId).single()
  if (!contrat || contrat.destinataire_email?.toLowerCase() !== payload.email.toLowerCase()) {
    return NextResponse.json({ error: 'Lien invalide.' }, { status: 401 })
  }
  if (contrat.profile_id) {
    return NextResponse.json({ error: 'Ce document est désormais rattaché à un compte My ABED. Connectez-vous pour le signer.' }, { status: 409 })
  }
  if (!contrat.destinataire_prenoms || !contrat.destinataire_nom) {
    return NextResponse.json({ error: 'Indiquez votre nom avant de signer.' }, { status: 400 })
  }
  if (contrat.signe_employe_le) return NextResponse.json({ error: 'Vous avez déjà signé ce document.' }, { status: 400 })
  if (!['envoye_employe', 'brouillon'].includes(contrat.workflow_statut ?? '')) {
    return NextResponse.json({ error: 'Ce document ne peut pas être signé à cette étape.' }, { status: 400 })
  }

  const isOffreStage = contrat.categorie_document === 'Offre de stage'
  const now = new Date().toISOString()
  const { error: updErr } = await admin.from('contrats').update({
    signe_employe_le: now,
    workflow_statut: isOffreStage ? 'finalise' : 'signe_employe',
  }).eq('id', contrat.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const nomDestinataire = `${contrat.destinataire_prenoms} ${contrat.destinataire_nom}`.trim()
  const ref = contrat.numero ?? contrat.id

  const { data: rhs } = await admin.from('profiles').select('id, email, prenoms').in('role', ['rh', 'admin', 'caf'])
  for (const rh of rhs ?? []) {
    await admin.from('notifications').insert({
      user_id: rh.id,
      titre: isOffreStage ? 'Offre de stage signée ✓' : 'Document signé par le destinataire',
      message: isOffreStage
        ? `${nomDestinataire} a signé son offre de stage (réf. ${ref}). Le document est finalisé.`
        : `${nomDestinataire} a signé son ${contrat.categorie_document ?? 'document'} (réf. ${ref}) via le lien externe. Vous pouvez maintenant l'envoyer au signataire.`,
      lien: '/rh/contrats',
    })
    if (rh.email) {
      try {
        await sendEmail({
          to: rh.email,
          subject: isOffreStage ? `[My ABED] Offre de stage finalisée — ${nomDestinataire}` : `[My ABED] Document signé par ${nomDestinataire}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#064e3b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">My ABED — ${isOffreStage ? 'Offre de stage finalisée ✓' : 'Document signé ✓'}</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour <strong>${rh.prenoms ?? ''}</strong>,</p>
    <p style="font-size:14px;color:#374151;"><strong>${nomDestinataire}</strong> (${contrat.destinataire_email}) a signé son ${contrat.categorie_document ?? 'document'} via le lien externe (sans compte My ABED) :</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:16px 0;">
      <strong>${ref}</strong><br/>
      <span style="font-size:13px;color:#6b7280;">${contrat.type_contrat} — ${contrat.poste ?? '—'}</span>
    </div>
    <a href="${APP_URL}/rh/contrats" style="display:inline-block;background:#064e3b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
      Gérer les contrats →
    </a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
        })
      } catch (e) { console.error('[contrats externe sign] email RH:', e) }
    }
  }

  revalidateTag('contrats')
  return NextResponse.json({ ok: true, workflow_statut: isOffreStage ? 'finalise' : 'signe_employe' })
}
