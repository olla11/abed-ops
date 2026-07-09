import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.app'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const motif = (body?.motif ?? '').trim()
  if (motif.length < 10) {
    return NextResponse.json({ error: 'Le motif est obligatoire (minimum 10 caractères).' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: contrat } = await admin
    .from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email)')
    .eq('id', id)
    .single()

  if (!contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
  if (contrat.signataire_id !== user.id) return NextResponse.json({ error: "Vous n'êtes pas le signataire de ce contrat" }, { status: 403 })
  if (contrat.workflow_statut !== 'envoye_signataire') {
    return NextResponse.json({ error: 'Ce contrat ne peut pas être renvoyé à cette étape' }, { status: 400 })
  }

  const { error: updateErr } = await admin.from('contrats').update({
    workflow_statut: 'rejete_signataire',
    commentaires_signataire: motif,
  }).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const { data: signataireProfile } = await admin.from('profiles').select('nom, prenoms').eq('id', user.id).single()
  const nomSignataire = signataireProfile ? `${signataireProfile.prenoms} ${signataireProfile.nom}` : 'Le signataire'
  const profile = contrat.profile as any
  const nomEmploye = `${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`.trim()
  const ref = contrat.numero ?? contrat.id

  const { data: rhs } = await admin.from('profiles').select('id, email, prenoms').in('role', ['rh', 'admin'])
  for (const rh of rhs ?? []) {
    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: rh.id,
      titre: 'Contrat renvoyé sans signature',
      message: `${nomSignataire} a renvoyé le ${contrat.categorie_document ?? 'contrat'} de ${nomEmploye} (réf. ${ref}) sans signer. Motif : ${motif}`,
      lien: '/rh/contrats',
    })
    if (notifErr) console.error('[refuser-signataire] notif RH:', notifErr)
    if (rh.email) {
      try {
        await sendEmail({
          to: rh.email,
          subject: `[My ABED] Contrat renvoyé sans signature — réf. ${ref}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#b45309;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">My ABED — Contrat renvoyé sans signature</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour <strong>${rh.prenoms ?? ''}</strong>,</p>
    <p style="font-size:14px;color:#374151;">
      <strong>${nomSignataire}</strong> a renvoyé le ${contrat.categorie_document ?? 'contrat'} de <strong>${nomEmploye}</strong> (réf. ${ref}) sans le signer.
    </p>
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
      } catch (e) { console.error('[refuser-signataire] email RH:', e) }
    }
  }

  return NextResponse.json({ ok: true, workflow_statut: 'rejete_signataire' })
}
