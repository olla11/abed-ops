import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { escapeHtml } from '@/lib/html'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: cafProfile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()
  if (!['caf', 'admin'].includes(cafProfile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const body = await req.json()
  const { prestataire_id, montant, heures_payees, note } = body
  if (!prestataire_id || !montant || +montant <= 0) {
    return NextResponse.json({ error: 'prestataire_id et montant requis' }, { status: 400 })
  }

  // Insérer le paiement
  const { error } = await supabase.from('paiements_prestataires').insert({
    prestataire_id,
    montant: +montant,
    heures_payees: heures_payees ? +heures_payees : null,
    note: note || null,
    caf_id: user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Infos prestataire
  const { data: prest } = await supabase
    .from('profiles').select('nom, prenoms, email').eq('id', prestataire_id).single()

  // Notification
  await supabase.from('notifications').insert({
    user_id: prestataire_id,
    titre: 'Paiement crédit reçu ✓',
    message: `${(+montant).toLocaleString('fr-FR')} XOF${heures_payees ? ` (${heures_payees} h)` : ''} ont été versés sur votre solde.`,
    lien: '/timesheets',
  })

  // Email reçu
  if (prest?.email) {
    try {
      await sendEmail({
        to: prest.email,
        subject: `[ABED-ONG] Versement sur votre solde — ${(+montant).toLocaleString('fr-FR')} XOF`,
        html: buildRecuCredit({ prest, montant: +montant, heures_payees, note, cafProfile }),
      })
    } catch (e: any) {
      console.error('[Email] Échec reçu paiement crédit:', e)
    }
  }

  return NextResponse.json({ ok: true })
}

function buildRecuCredit({ prest, montant, heures_payees, note, cafProfile }: any) {
  const now = new Date().toLocaleDateString('fr-FR')
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">ABED-ONG — Versement prestataire</h1>
      </div>
      <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p>Bonjour <strong>${escapeHtml(prest.prenoms)} ${escapeHtml(prest.nom)}</strong>,</p>
        <p>Un versement a été effectué sur votre solde ABED-ONG.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="font-weight:600;padding:6px 0;width:180px;">Montant versé</td>
              <td><strong style="color:#166534;font-size:16px;">${montant.toLocaleString('fr-FR')} XOF</strong></td></tr>
          ${heures_payees ? `<tr><td style="font-weight:600;padding:6px 0;">Heures payées</td><td>${heures_payees} h</td></tr>` : ''}
          ${note ? `<tr><td style="font-weight:600;padding:6px 0;">Note</td><td>${escapeHtml(note)}</td></tr>` : ''}
          <tr><td style="font-weight:600;padding:6px 0;">Date</td><td>${now}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Validé par</td><td>${escapeHtml(cafProfile.prenoms)} ${escapeHtml(cafProfile.nom)} (CAF)</td></tr>
        </table>
        <p>Connectez-vous pour vérifier votre solde mis à jour.</p>
        <p style="font-size:12px;color:#6b7280;">ABED-ONG · contact@abedong.org · +229 0167779141</p>
      </div>
    </div>`
}
