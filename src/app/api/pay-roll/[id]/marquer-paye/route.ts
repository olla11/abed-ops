import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { estAAF } from '@/lib/roles'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.app'

const SOURCE_LABELS: Record<string, string> = {
  demande_paiement: 'Demande de paiement',
  rapport_allocation: 'Allocation',
  reconciliation_mission: 'Réconciliation de mission',
  timesheet: 'Timesheet',
}

// POST — seule action possible pour l'AAF sur Pay Roll : marquer un paiement
// "Payé", ligne par ligne, une fois son appel de fonds signé par le circuit
// DE → TG CA → PCA. Écrit aussi dans depenses_executees (alimente
// l'exécution financière temps réel) et notifie le bénéficiaire par email.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estAAF(profile?.role) || ['admin', 'superadmin'].includes(profile?.role ?? ''))) {
    return NextResponse.json({ error: 'accès refusé — AAF uniquement' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: item } = await admin
    .from('pay_roll')
    .select('*, appel_de_fonds:appels_de_fonds(id, statut, numero)')
    .eq('id', id).single()

  if (!item) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (item.statut === 'paye') return NextResponse.json({ error: 'Déjà payé.' }, { status: 400 })
  if (item.statut !== 'a_payer') return NextResponse.json({ error: 'Ce paiement doit être au statut "À payer".' }, { status: 400 })

  const appel = item.appel_de_fonds as any
  if (!appel || appel.statut !== 'signe') {
    return NextResponse.json({ error: "L'appel de fonds correspondant n'est pas encore signé par le circuit DE → TG CA → PCA." }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error: updErr } = await admin.from('pay_roll').update({
    statut: 'paye', paye_le: now, paye_par: user.id,
  }).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  // Garde le dossier d'origine synchronisé quand il porte déjà lui-même un
  // suivi de paiement (seul le cas des timesheets aujourd'hui — les 3 autres
  // sources n'ont pas de champ "payé" propre, Pay Roll en devient l'autorité).
  if (item.source_type === 'timesheet') {
    await admin.from('soumissions').update({ paye: true, paye_le: now, paye_par: user.id }).eq('id', item.source_id)
  }

  await admin.from('depenses_executees').insert({
    pay_roll_id: item.id,
    code_budgetaire: item.code_budgetaire,
    montant: item.montant,
    date_paiement: now.slice(0, 10),
    source_type: item.source_type,
    source_id: item.source_id,
    description: `${SOURCE_LABELS[item.source_type] ?? item.source_type} — ${item.beneficiaire_nom} — ${item.objet}`,
  })

  after(async () => {
    if (item.beneficiaire_id) {
      await admin.from('notifications').insert({
        user_id: item.beneficiaire_id,
        titre: 'Paiement effectué ✓',
        message: `${item.objet} — ${Number(item.montant).toLocaleString('fr-FR')} FCFA payés.`,
        lien: item.source_type === 'timesheet' ? '/timesheets' : '/demandes',
      }).then(({ error: e }) => { if (e) console.error('[pay-roll] notif bénéficiaire:', e) })

      const { data: beneficiaire } = await admin.from('profiles').select('nom, prenoms, email').eq('id', item.beneficiaire_id).single()
      if (beneficiaire?.email) {
        const docLien = item.source_type === 'rapport_allocation'
          ? `${APP_URL}/api/rapports-allocations/${item.source_id}/etat-paiement-pdf`
          : null
        await sendEmail({
          to: beneficiaire.email,
          subject: `[ABED-ONG] Reçu de paiement — ${item.objet}`,
          html: buildRecu({ beneficiaire, item, appelNumero: appel.numero, docLien }),
        }).catch(e => console.error('[pay-roll] email bénéficiaire:', e))
      }
    }
  })

  return NextResponse.json({ ok: true })
}

function buildRecu({ beneficiaire, item, appelNumero, docLien }: any) {
  const now = new Date().toLocaleDateString('fr-FR')
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">ABED-ONG — Reçu de paiement</h1>
      </div>
      <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p>Bonjour <strong>${beneficiaire.prenoms} ${beneficiaire.nom}</strong>,</p>
        <p>Votre paiement a été effectué.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="font-weight:600;padding:6px 0;width:180px;">Type</td><td>${SOURCE_LABELS[item.source_type] ?? item.source_type}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Objet</td><td>${item.objet}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Montant payé</td><td><strong style="color:#166534;font-size:16px;">${Number(item.montant).toLocaleString('fr-FR')} FCFA</strong></td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Date de paiement</td><td>${now}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;">Appel de fonds</td><td>N° ${appelNumero}</td></tr>
        </table>
        ${docLien ? `<a href="${docLien}" style="display:inline-block;background:#63a521;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:12px;">📄 Télécharger le document</a><br/>` : ''}
        <p style="font-size:12px;color:#6b7280;">Ce document vaut reçu de paiement. Conservez-le pour vos archives.</p>
        <p style="font-size:12px;color:#6b7280;">ABED-ONG · contact@abedong.org · +229 0167779141</p>
      </div>
    </div>`
}
