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

  const admin = createAdminClient()
  const { data: contrat } = await admin
    .from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email)')
    .eq('id', id)
    .single()

  if (!contrat) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
  if (contrat.signataire_id !== user.id) return NextResponse.json({ error: "Vous n'êtes pas le signataire de ce contrat" }, { status: 403 })
  if (contrat.workflow_statut !== 'envoye_signataire') {
    return NextResponse.json({ error: 'Ce contrat ne peut pas être signé à cette étape' }, { status: 400 })
  }

  let { error: updateErr } = await admin.from('contrats').update({
    workflow_statut: 'signe_signataire',
    signe_signataire_le: new Date().toISOString(),
  }).eq('id', id)
  if (updateErr) {
    // La colonne signe_signataire_le peut ne pas encore exister (migration non appliquée) :
    // on ne bloque jamais la signature pour ça.
    console.error('[signer-signataire] update avec signe_signataire_le a échoué, retry sans:', updateErr)
    const retry = await admin.from('contrats').update({ workflow_statut: 'signe_signataire' }).eq('id', id)
    updateErr = retry.error
  }
  if (updateErr) {
    console.error('[signer-signataire] update contrat:', updateErr)
    return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
  }

  // Best-effort : refléter la signature dans le système générique de signatures s'il existe,
  // mais ne jamais bloquer la signature du contrat si ce circuit est absent ou en échec.
  if (contrat.demande_signature_id) {
    const { error: sigErr } = await admin.from('signataires')
      .update({ signe: true, signe_le: new Date().toISOString() })
      .eq('demande_id', contrat.demande_signature_id)
      .eq('profile_id', user.id)
    if (sigErr) console.error('[signer-signataire] maj signataires (best-effort):', sigErr)
    const { data: allSigs } = await admin.from('signataires').select('signe').eq('demande_id', contrat.demande_signature_id)
    if (allSigs?.every(s => s.signe)) {
      const { error: demErr } = await admin.from('demandes_signature')
        .update({ statut: 'complete', updated_at: new Date().toISOString() })
        .eq('id', contrat.demande_signature_id)
      if (demErr) console.error('[signer-signataire] maj demande complete (best-effort):', demErr)
    }
  }

  const profile = contrat.profile as any
  const nomEmploye = `${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`.trim()
  const ref = contrat.numero ?? contrat.id

  const { data: signataireProfile } = await admin.from('profiles').select('nom, prenoms').eq('id', user.id).single()
  const nomSignataire = signataireProfile ? `${signataireProfile.prenoms} ${signataireProfile.nom}` : 'Le signataire'

  const { data: rhs } = await admin.from('profiles').select('id, email, prenoms').in('role', ['rh', 'admin'])
  for (const rh of rhs ?? []) {
    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: rh.id,
      titre: 'Contrat signé par le signataire ✓',
      message: `${nomSignataire} a signé le ${contrat.categorie_document ?? 'contrat'} de ${nomEmploye} (réf. ${ref}). Vous pouvez maintenant le finaliser.`,
      lien: '/rh/contrats',
    })
    if (notifErr) console.error('[signer-signataire] notif in-app RH:', notifErr)
    if (rh.email) {
      try {
        await sendEmail({
          to: rh.email,
          subject: `[My ABED] Contrat signé par ${nomSignataire} — réf. ${ref}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#064e3b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">My ABED — Contrat signé ✓</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour <strong>${rh.prenoms ?? ''}</strong>,</p>
    <p style="font-size:14px;color:#374151;">
      <strong>${nomSignataire}</strong> a signé le ${contrat.categorie_document ?? 'contrat'} de <strong>${nomEmploye}</strong> :
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:16px 0;">
      <strong>${ref}</strong><br/>
      <span style="font-size:13px;color:#6b7280;">${contrat.type_contrat} — ${contrat.poste ?? '—'}</span>
    </div>
    <p style="font-size:14px;color:#374151;">Vous pouvez maintenant le finaliser et le transmettre à l'employé.</p>
    <a href="${APP_URL}/rh/contrats" style="display:inline-block;background:#064e3b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
      Gérer les contrats →
    </a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
        })
      } catch (e) { console.error('[signer-signataire] email RH:', e) }
    }
  }

  return NextResponse.json({ ok: true, workflow_statut: 'signe_signataire' })
}
