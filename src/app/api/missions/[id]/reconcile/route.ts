import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { createMomoDebit } from '@/lib/fedapay'
import { sendEmail } from '@/lib/resend'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json()
  const { point_financier, montant_recu, rapport, mode_financement } = body

  const totalDepenses = Array.isArray(point_financier)
    ? point_financier.reduce((s: number, l: any) => s + (Number(l.montant) || 0), 0)
    : 0

  // Vérifier que la mission appartient bien à cet utilisateur
  const { data: missionCheck } = await supabase
    .from('missions').select('id, missionnaire_id').eq('id', id).single()
  if (!missionCheck || missionCheck.missionnaire_id !== user.id) {
    return NextResponse.json({ error: 'mission introuvable' }, { status: 404 })
  }

  // Statut initial selon mode
  const statusInitial = mode_financement === 'totalite_avant' ? 'cloture' : 'reconciliation_caf'

  // Service role pour contourner la RLS WITH CHECK qui bloque status='cloture' pour le missionnaire
  const admin = createAdminClient()
  const { data: mission, error } = await admin
    .from('missions')
    .update({
      point_financier,
      montant_recu: montant_recu ?? 0,
      total_depenses: totalDepenses,
      rapport,
      mode_financement: mode_financement ?? null,
      status: statusInitial,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: error?.message ?? 'mission introuvable' }, { status: 400 })
  }

  // ── Cas partenaire : prélèvement FedaPay ──
  if (mission.a_charge_partenaire && mission.prelevement_20 && mission.prelevement_20 > 0) {
    await admin.from('missions').update({ status: 'paiement_attente' }).eq('id', id)

    const { data: profile } = await supabase
      .from('profiles').select('telephone, nom, prenoms').eq('id', user.id).single()

    if (!profile?.telephone) {
      return NextResponse.json({ error: 'Numéro Mobile Money manquant dans le profil' }, { status: 400 })
    }

    await supabase.from('payments').insert({
      mission_id: mission.id,
      montant: mission.prelevement_20,
      telephone: profile.telephone,
      status: 'en_attente',
    })

    try {
      const { fedapayTxId } = await createMomoDebit({
        montant: mission.prelevement_20,
        telephone: profile.telephone,
        description: `Prélèvement 20% mission ${mission.reference ?? mission.id}`,
        missionId: mission.id,
      })
      await supabase.from('payments').update({ fedapay_tx_id: fedapayTxId }).eq('mission_id', mission.id)

      // Notif in-app
      await admin.from('notifications').insert({
        user_id: user.id,
        titre: 'Prélèvement MTN MoMo en cours',
        message: `Un prélèvement de ${Number(mission.prelevement_20).toLocaleString('fr-FR')} F CFA (20%) a été initié sur le ${profile.telephone}. Confirmez sur votre téléphone.`,
        lien: `/missions/${mission.id}`,
      })

      return NextResponse.json({
        ok: true,
        prelevement: mission.prelevement_20,
        message: `Un push MTN MoMo de ${Number(mission.prelevement_20).toLocaleString('fr-FR')} F CFA a été envoyé au ${profile.telephone}. Confirmez sur votre téléphone pour clôturer la mission.`,
      })
    } catch (e: any) {
      await supabase.from('payments').update({ status: 'echoue' }).eq('mission_id', mission.id)
      await admin.from('missions').update({ status: 'reconciliation' }).eq('id', id)
      return NextResponse.json({ error: `Échec FedaPay: ${e.message}` }, { status: 502 })
    }
  }

  // ── Cas non-partenaire : totalite_avant → cloture directe ──
  if (mode_financement === 'totalite_avant') {
    // Notifier le missionnaire
    await admin.from('notifications').insert({
      user_id: user.id,
      titre: 'Mission clôturée',
      message: `Votre réconciliation pour la mission ${mission.reference ?? ''} a été enregistrée. Mission clôturée automatiquement (totalité reçue avant départ).`,
      lien: `/missions/${id}`,
    })

    // Envoyer rapport au DE et CAF par email
    const { data: gestionnaires } = await admin
      .from('profiles').select('email, id').in('role', ['de', 'caf', 'administrateur'])
    const emails = (gestionnaires ?? []).map((g: any) => g.email).filter(Boolean)
    let emailSent = false
    let emailError: string | null = null
    if (emails.length > 0) {
      try {
        await sendEmail({
          to: emails,
          subject: `[ABED] Rapport consolidé — Mission ${mission.reference ?? mission.id}`,
          html: buildEmailHtml(mission, rapport, point_financier, totalDepenses, 'Totalité reçue avant départ'),
        })
        emailSent = true
      } catch (e: any) {
        emailError = e.message ?? 'Erreur inconnue'
        console.error('[Email] Échec envoi rapport cloture:', e)
      }
    }
    for (const g of gestionnaires ?? []) {
      await admin.from('notifications').insert({
        user_id: (g as any).id,
        titre: `Mission clôturée — ${mission.reference ?? id}`,
        message: `La mission « ${mission.objet} » a été clôturée (totalité reçue avant départ). Rapport archivé par email.`,
        lien: `/missions/${id}`,
      })
    }

    return NextResponse.json({
      ok: true,
      status: 'cloture',
      email_sent: emailSent,
      email_error: emailError,
      message: emailSent
        ? 'Mission clôturée automatiquement. Rapport envoyé au DE et à la CAF.'
        : 'Mission clôturée. L\'email n\'a pas pu être envoyé — vous pouvez réessayer.',
    })
  }

  // ── Cas non-partenaire crédit ou avance → validation CAF ──
  const { data: cafs } = await supabase
    .from('profiles').select('id').in('role', ['caf', 'admin'])
  for (const c of cafs ?? []) {
    await supabase.from('notifications').insert({
      user_id: c.id,
      titre: `Réconciliation à valider — Mission ${mission.reference ?? id}`,
      message: `La réconciliation de la mission « ${mission.objet} » est soumise pour validation CAF. Mode financement : ${modeLabelFr(mode_financement)}.`,
      lien: `/missions/${id}`,
    })
  }

  return NextResponse.json({
    ok: true,
    status: 'reconciliation_caf',
    message: 'Réconciliation transmise à la CAF pour validation.',
  })
}

function modeLabelFr(mode: string | null) {
  const labels: Record<string, string> = {
    credit: 'à crédit',
    avance: 'sur avance',
    totalite_avant: 'totalité reçue avant départ',
  }
  return labels[mode ?? ''] ?? '—'
}

function buildEmailHtml(mission: any, rapport: any, pf: any[], totalDepenses: number, modeLabel: string) {
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  const missionnaire = mission.missionnaire as any ?? {}
  const pfHtml = pf.map((l: any) =>
    `<tr><td>${l.libelle}</td><td>${l.quantite}</td><td>${Number(l.pu).toLocaleString('fr-FR')} F</td><td><strong>${Number(l.montant).toLocaleString('fr-FR')} F</strong></td></tr>`
  ).join('')

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #63a521; color: white; padding: 20px 28px; border-radius: 8px 8px 0 0;">
        <h1 style="margin:0; font-size: 22px;">ABED-ONG — Rapport de mission clôturée</h1>
      </div>
      <div style="background: #f9fafb; padding: 24px 28px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tr><td style="font-weight:600; width:200px; padding:6px 0;">Référence</td><td>${mission.reference ?? mission.id}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Objet</td><td>${mission.objet}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Lieu</td><td>${mission.lieu}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Période</td><td>${fmtDate(mission.date_depart)} → ${fmtDate(mission.date_retour)}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Mode financement</td><td>${modeLabel}</td></tr>
        </table>
        <h3 style="color:#63a521; border-bottom:1px solid #e5e7eb; padding-bottom:8px;">Rapport</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tr><td style="font-weight:600; width:150px; padding:6px 0; vertical-align:top;">Objectifs</td><td>${rapport?.objectifs ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Activités</td><td>${rapport?.activites ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Résultats</td><td>${rapport?.resultats ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Difficultés</td><td>${rapport?.difficultes ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Suite</td><td>${rapport?.suite ?? '—'}</td></tr>
        </table>
        <h3 style="color:#63a521; border-bottom:1px solid #e5e7eb; padding-bottom:8px;">Point financier</h3>
        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:12px;">
          <thead><tr style="background:#f3f4f6;"><th style="padding:8px; text-align:left;">Libellé</th><th style="padding:8px;">Qté</th><th style="padding:8px;">P.U.</th><th style="padding:8px;">Montant</th></tr></thead>
          <tbody>${pfHtml}</tbody>
        </table>
        <div style="text-align:right; font-weight:700;">Total dépenses : ${totalDepenses.toLocaleString('fr-FR')} F CFA</div>
        <p style="margin-top:24px; font-size:12px; color:#6b7280;">Rapport généré le ${new Date().toLocaleDateString('fr-FR')}.</p>
      </div>
    </div>`
}
