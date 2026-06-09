import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()
  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, titre, montant_caf, heures_retenues, periode_mois, periode_annee, paye, prestataire:profiles!soumissions_prestataire_id_fkey(nom, prenoms, email)')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.status === 'paye' || soum.paye) return NextResponse.json({ error: 'Déjà payé' }, { status: 400 })
  if (!soum.montant_caf) return NextResponse.json({ error: 'Dossier non validé CAF' }, { status: 400 })

  const { error } = await supabase.from('soumissions').update({
    paye: true,
    paye_le: new Date().toISOString(),
    paye_par: user.id,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const prest = soum.prestataire as any
  const moisNom = new Date(soum.periode_annee, soum.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // Notification
  await supabase.from('notifications').insert({
    user_id: soum.prestataire_id,
    titre: 'Paiement effectué ✓',
    message: `${soum.titre} — ${soum.montant_caf!.toLocaleString('fr-FR')} XOF payés pour ${moisNom}.`,
    lien: '/timesheets',
  })

  // Email facture
  if (prest?.email) {
    try {
      await sendEmail({
        to: prest.email,
        subject: `[ABED-ONG] Reçu de paiement — ${soum.titre}`,
        html: buildRecu({ prest, soum, moisNom, payePar: profile }),
      })
    } catch (e: any) {
      console.error('[Email] Échec reçu paiement direct:', e)
    }
  }

  return NextResponse.json({ ok: true })
}

function buildRecu({ prest, soum, moisNom, payePar }: any) {
  const now = new Date().toLocaleDateString('fr-FR')
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">ABED-ONG — Reçu de paiement</h1>
      </div>
      <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p>Bonjour <strong>${prest.prenoms} ${prest.nom}</strong>,</p>
        <p>Votre paiement pour la période <strong>${moisNom}</strong> a été effectué.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="font-weight:600;padding:6px 0;width:180px;">Dossier</td><td>${soum.titre}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Période</td><td>${moisNom}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Heures retenues</td><td>${soum.heures_retenues} h</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Montant payé</td><td><strong style="color:#166534;font-size:16px;">${soum.montant_caf.toLocaleString('fr-FR')} XOF</strong></td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Date de paiement</td><td>${now}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Validé par</td><td>${payePar.prenoms} ${payePar.nom} (CAF)</td></tr>
        </table>
        <p style="font-size:12px;color:#6b7280;">Ce document vaut reçu de paiement. Conservez-le pour vos archives.</p>
        <p style="font-size:12px;color:#6b7280;">ABED-ONG · contact@abedong.org · +229 0167779141</p>
      </div>
    </div>`
}
