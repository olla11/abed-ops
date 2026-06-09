import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// POST /api/missions/[id]/valider-reconciliation
// body: { action: 'valider' | 'rejeter', commentaire?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()
  if (!profile || !['caf', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accès réservé à la CAF' }, { status: 403 })
  }

  const { action, commentaire } = await req.json()
  if (!['valider', 'rejeter'].includes(action)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }
  if (action === 'rejeter' && !commentaire?.trim()) {
    return NextResponse.json({ error: 'Un commentaire est requis pour le rejet' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: mission } = await admin
    .from('missions')
    .select(`
      *,
      missionnaire:profiles!missions_missionnaire_id_fkey(id, nom, prenoms, email)
    `)
    .eq('id', id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.status !== 'reconciliation_caf') {
    return NextResponse.json({ error: 'Cette mission n\'est pas en attente de validation CAF' }, { status: 400 })
  }

  if (action === 'rejeter') {
    await admin.from('missions').update({
      status: 'reconciliation',
      reconciliation_commentaire: commentaire,
    }).eq('id', id)

    // Notifier le missionnaire
    await admin.from('notifications').insert({
      user_id: mission.missionnaire_id,
      titre: 'Réconciliation rejetée — à corriger',
      message: `Votre réconciliation pour la mission ${mission.reference ?? ''} a été rejetée par la CAF. Commentaire : ${commentaire}`,
      lien: `/missions/${id}/reconciliation`,
    })

    return NextResponse.json({ ok: true, status: 'reconciliation' })
  }

  // Valider : clôturer la mission
  await admin.from('missions').update({
    status: 'cloture',
    reconciliation_commentaire: null,
  }).eq('id', id)

  const missionnaire = mission.missionnaire as any
  const rapport = mission.rapport as any ?? {}
  const pf = (mission.point_financier as any[]) ?? []
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

  const modeLabel: Record<string, string> = {
    credit: 'À crédit',
    avance: 'Sur avance',
    totalite_avant: 'Totalité reçue avant départ',
  }

  const pointFinancierHtml = pf.map((l: any) =>
    `<tr><td>${l.libelle}</td><td>${l.quantite}</td><td>${Number(l.pu).toLocaleString('fr-FR')} XOF</td><td><strong>${Number(l.montant).toLocaleString('fr-FR')} XOF</strong></td></tr>`
  ).join('')

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #63a521; color: white; padding: 20px 28px; border-radius: 8px 8px 0 0;">
        <h1 style="margin:0; font-size: 22px;">ABED-ONG — Rapport de mission clôturée</h1>
      </div>
      <div style="background: #f9fafb; padding: 24px 28px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tr><td style="font-weight:600; width:200px; padding:6px 0;">Référence</td><td>${mission.reference ?? mission.id}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Objet</td><td>${mission.objet}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Lieu</td><td>${mission.lieu}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Missionnaire</td><td>${missionnaire?.prenoms} ${missionnaire?.nom}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Période</td><td>${fmtDate(mission.date_depart)} → ${fmtDate(mission.date_retour)}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0;">Mode financement</td><td>${modeLabel[mission.mode_financement ?? ''] ?? '—'}</td></tr>
        </table>

        <h3 style="color:#63a521; border-bottom:1px solid #e5e7eb; padding-bottom:8px;">Rapport de mission</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tr><td style="font-weight:600; width:200px; padding:6px 0; vertical-align:top;">Objectifs</td><td>${rapport.objectifs ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Activités</td><td>${rapport.activites ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Résultats</td><td>${rapport.resultats ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Difficultés</td><td>${rapport.difficultes ?? '—'}</td></tr>
          <tr><td style="font-weight:600; padding:6px 0; vertical-align:top;">Suite à donner</td><td>${rapport.suite ?? '—'}</td></tr>
        </table>

        <h3 style="color:#63a521; border-bottom:1px solid #e5e7eb; padding-bottom:8px;">Point financier</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:14px;">
          <thead><tr style="background:#f3f4f6;"><th style="padding:8px; text-align:left;">Libellé</th><th style="padding:8px; text-align:left;">Qté</th><th style="padding:8px; text-align:left;">P.U.</th><th style="padding:8px; text-align:left;">Montant</th></tr></thead>
          <tbody>${pointFinancierHtml}</tbody>
        </table>
        <table style="width:100%; max-width:400px; border-collapse:collapse; margin-left:auto;">
          <tr><td style="padding:6px 0;">Total dépenses</td><td style="text-align:right; font-weight:600;">${Number(mission.total_depenses ?? 0).toLocaleString('fr-FR')} XOF</td></tr>
        </table>

        <p style="margin-top:24px; font-size:12px; color:#6b7280;">
          Ce rapport a été validé le ${new Date().toLocaleDateString('fr-FR')} par la CAF.
        </p>
      </div>
    </div>
  `

  // Notifier le missionnaire
  await admin.from('notifications').insert({
    user_id: mission.missionnaire_id,
    titre: 'Réconciliation validée — mission clôturée',
    message: `Votre réconciliation pour la mission ${mission.reference ?? ''} a été validée par la CAF. La mission est définitivement clôturée.`,
    lien: `/missions/${id}`,
  })

  // Envoyer email au DE et CAF pour archivage
  const { data: gestionnaires } = await admin
    .from('profiles').select('email, id').in('role', ['de', 'caf'])

  const emails = (gestionnaires ?? []).map(g => g.email).filter(Boolean)
  if (emails.length > 0) {
    try {
      await sendEmail({
        to: emails,
        subject: `[ABED] Rapport consolidé — Mission ${mission.reference ?? mission.id}`,
        html: emailHtml,
      })
    } catch (e) {
      console.error('[Email] Échec envoi rapport validation CAF:', e)
    }
  }

  // Notifications internes DE/CAF
  for (const g of gestionnaires ?? []) {
    if (g.id !== user.id) {
      await admin.from('notifications').insert({
        user_id: g.id,
        titre: `Réconciliation validée — Mission ${mission.reference ?? id}`,
        message: `La réconciliation de la mission ${mission.objet} (${mission.reference ?? ''}) a été validée. Rapport archivé par email.`,
        lien: `/missions/${id}`,
      })
    }
  }

  return NextResponse.json({ ok: true, status: 'cloture' })
}
