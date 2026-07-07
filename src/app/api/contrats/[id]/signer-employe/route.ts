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
  if (contrat.profile_id !== user.id) return NextResponse.json({ error: 'Ce contrat ne vous appartient pas' }, { status: 403 })
  if (contrat.signe_employe_le) return NextResponse.json({ error: 'Vous avez déjà signé ce contrat' }, { status: 400 })
  if (!['envoye_employe', 'brouillon'].includes(contrat.workflow_statut ?? '')) {
    return NextResponse.json({ error: 'Ce contrat ne peut pas être signé à cette étape' }, { status: 400 })
  }

  const now = new Date().toISOString()
  await admin.from('contrats').update({
    signe_employe_le: now,
    workflow_statut: 'signe_employe',
  }).eq('id', id)

  const profile = contrat.profile as any
  const nomEmploye = `${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`.trim()

  // Notifier le RH
  const { data: rhs } = await admin.from('profiles').select('id, email, prenoms').in('role', ['rh', 'admin'])
  for (const rh of rhs ?? []) {
    await admin.from('notifications').insert({
      user_id: rh.id,
      titre: 'Contrat signé par l\'employé',
      message: `${nomEmploye} a signé son ${contrat.categorie_document ?? 'contrat'} (réf. ${contrat.numero ?? contrat.id}). Vous pouvez maintenant l'envoyer au signataire.`,
      lien: '/rh/contrats',
    })
    if (rh.email) {
      try {
        await sendEmail({
          to: rh.email,
          subject: `[My ABED] Contrat signé par ${nomEmploye}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#064e3b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:19px;">My ABED — Contrat signé ✓</h1>
  </div>
  <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>Bonjour <strong>${rh.prenoms ?? ''}</strong>,</p>
    <p style="font-size:14px;color:#374151;">
      <strong>${nomEmploye}</strong> a signé son ${contrat.categorie_document ?? 'contrat'} :
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:16px 0;">
      <strong>${contrat.numero ?? contrat.id}</strong><br/>
      <span style="font-size:13px;color:#6b7280;">${contrat.type_contrat} — ${contrat.poste ?? '—'}</span>
    </div>
    <p style="font-size:14px;color:#374151;">Vous pouvez maintenant envoyer le contrat au signataire pour autorisation.</p>
    <a href="${APP_URL}/rh/contrats" style="display:inline-block;background:#064e3b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
      Gérer les contrats →
    </a>
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">ABED-ONG · my.abedong.org</p>
  </div>
</div>`,
        })
      } catch (e) { console.error('[signer-employe] email RH:', e) }
    }
  }

  return NextResponse.json({ ok: true, workflow_statut: 'signe_employe' })
}
