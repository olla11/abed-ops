import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { notifyMissionUser, notifyMissionByRole } from '@/lib/mission-notify'
import { autoSkipReconciliationOM } from '@/lib/circuit-vacancy'
import { montantDon } from '@/lib/dons'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json()
  const { point_financier, montant_recu, rapport, mode_financement, pieces_jointes, don } = body

  const totalDepenses = Array.isArray(point_financier)
    ? point_financier.reduce((s: number, l: any) => s + (Number(l.montant) || 0), 0)
    : 0

  // Vérifier que la mission appartient bien à cet utilisateur
  const { data: missionCheck } = await supabase
    .from('missions').select('id, missionnaire_id, a_charge_partenaire').eq('id', id).single()
  if (!missionCheck || missionCheck.missionnaire_id !== user.id) {
    return NextResponse.json({ error: 'mission introuvable' }, { status: 404 })
  }

  // Don ABED Héritage (facultatif). Partenaire : un pourcentage du montant
  // reçu du partenaire, versé par MoMo Pay — la capture est obligatoire.
  // Crédit/avance : renonciation à un pourcentage du montant dû par ABED,
  // sans versement (réappliqué au montant réel à la clôture, voir dons.ts).
  const pourcentageDon = Number(don?.pourcentage)
  const avecDon = don && Number.isFinite(pourcentageDon) && pourcentageDon > 0
  let ligneDon: Record<string, unknown> | null = null
  if (avecDon) {
    if (pourcentageDon > 100) return NextResponse.json({ error: 'Pourcentage de don invalide.' }, { status: 400 })
    if (missionCheck.a_charge_partenaire) {
      if (typeof don.capture_path !== 'string' || !don.capture_path.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: 'Joignez la capture du paiement MoMo de votre don.' }, { status: 400 })
      }
      const base = Number(montant_recu) || 0
      ligneDon = { type: 'partenaire', base_montant: base, montant: montantDon(base, pourcentageDon), capture_path: don.capture_path }
    } else if (mode_financement === 'credit' || mode_financement === 'avance') {
      const base = mode_financement === 'credit' ? totalDepenses : Math.max(0, totalDepenses - (Number(montant_recu) || 0))
      if (base <= 0) return NextResponse.json({ error: 'Aucun montant dû par ABED : pas de don possible sur cette mission.' }, { status: 400 })
      ligneDon = { type: 'abandon_credit', base_montant: base, montant: montantDon(base, pourcentageDon), capture_path: null }
    }
  }

  // Statut initial selon mode
  const statusInitial = mode_financement === 'totalite_avant' ? 'cloture' : 'reconciliation_aaf'

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
      reconciliation_pieces_jointes: Array.isArray(pieces_jointes) ? pieces_jointes : [],
      status: statusInitial,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: error?.message ?? 'mission introuvable' }, { status: 400 })
  }

  // Resoumission après rejet : le don éventuel est remplacé (ou retiré).
  // Un don déjà confirmé n'est plus jamais touché.
  await admin.from('dons').delete().eq('mission_id', id).neq('statut', 'confirme')
  if (ligneDon) {
    const { data: dejaConfirme } = await admin.from('dons').select('id').eq('mission_id', id).maybeSingle()
    if (!dejaConfirme) {
      await admin.from('dons').insert({ ...ligneDon, mission_id: id, profile_id: user.id, pourcentage: pourcentageDon, statut: 'declare' })
    }
  }

  // ── Cas non-partenaire : totalite_avant → cloture directe ──
  if (mode_financement === 'totalite_avant') {
    // Notifier le missionnaire
    await notifyMissionUser(admin, {
      userId: user.id,
      missionId: id,
      titre: 'Mission clôturée',
      message: `Votre réconciliation pour la mission ${mission.reference ?? ''} a été enregistrée. Mission clôturée automatiquement (totalité reçue avant départ).`,
    })

    // Envoyer rapport au DE et CAF par email
    const { data: gestionnaires } = await admin
      .from('profiles').select('email, id').in('role', ['de', 'dp', 'caf', 'administrateur'])
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

  // ── Cas non-partenaire crédit ou avance → validation AAF puis CAF ──
  await notifyMissionByRole(admin, {
    roles: ['aaf', 'admin', 'caf'],
    missionId: id,
    excludeId: user.id,
    titre: `Réconciliation à valider — Mission ${mission.reference ?? id}`,
    message: `La réconciliation de la mission « ${mission.objet} » est soumise pour validation AAF. Mode financement : ${mission.a_charge_partenaire ? 'à charge partenaire' : modeLabelFr(mode_financement)}.${ligneDon ? ` Don ABED Héritage déclaré : ${Number(ligneDon.montant).toLocaleString('fr-FR')} F CFA.` : ''}`,
  })

  // Si aucun compte AAF (ni CAF, qui en hérite les droits) n'est actif,
  // fait sauter automatiquement l'étape plutôt que de bloquer la réconciliation.
  await autoSkipReconciliationOM(admin, id).catch(e => console.error('[autoSkipReconciliationOM]:', e))

  return NextResponse.json({
    ok: true,
    status: 'reconciliation_aaf',
    message: 'Réconciliation transmise à l\'AAF pour validation.',
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
