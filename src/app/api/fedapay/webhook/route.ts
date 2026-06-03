import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/fedapay'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const signature = req.headers.get('x-fedapay-signature')

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 })
  }

  const event = JSON.parse(raw)
  const name: string = event.name || event.event
  const tx = event.entity || event.data?.object || {}
  const missionId = tx?.custom_metadata?.mission_id
  const txId = String(tx?.id ?? '')

  const supabase = createAdminClient()

  if (name === 'transaction.approved') {
    await supabase
      .from('payments')
      .update({ status: 'reussi', confirmed_at: new Date().toISOString(), raw_webhook: event, fedapay_tx_id: txId })
      .eq('mission_id', missionId)

    await supabase.from('missions').update({ status: 'cloture' }).eq('id', missionId)

    // Récupérer la mission complète pour le rapport consolidé
    const { data: mission } = await supabase
      .from('missions')
      .select(`
        *,
        missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms, email, telephone, fonction),
        signataire:profiles!missions_signe_par_fkey(nom, prenoms)
      `)
      .eq('id', missionId).single()

    if (mission) {
      const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
      const rapport = mission.rapport as any ?? {}
      const pf = (mission.point_financier as any[]) ?? []
      const montant = mission.prelevement_20 ?? 0

      const rapportResume = [
        `Objectifs : ${rapport.objectifs ?? '—'}`,
        `Activités : ${rapport.activites ?? '—'}`,
        `Résultats : ${rapport.resultats ?? '—'}`,
        `Difficultés : ${rapport.difficultes ?? '—'}`,
        `Suite : ${rapport.suite ?? '—'}`,
      ].join(' | ')

      const pointFinancier = pf.map((l: any) =>
        `${l.libelle} × ${l.quantite} à ${l.pu} F = ${l.montant} F`
      ).join(', ')

      const msgComplet =
        `Mission : ${mission.objet} (${mission.reference ?? mission.id}) — ${mission.lieu}\n` +
        `Missionnaire : ${(mission.missionnaire as any)?.prenoms} ${(mission.missionnaire as any)?.nom}\n` +
        `Période : ${fmtDate(mission.date_depart)} → ${fmtDate(mission.date_retour)}\n` +
        `Rapport : ${rapportResume}\n` +
        `Point financier : ${pointFinancier}\n` +
        `Montant reçu : ${mission.montant_recu ?? 0} F — Total dépenses : ${mission.total_depenses ?? 0} F\n` +
        `Prélèvement ABED 20% : ${montant} F — Solde missionnaire : ${mission.solde_missionnaire ?? 0} F`

      // Notifier le missionnaire
      await supabase.from('notifications').insert({
        user_id: mission.missionnaire_id,
        titre: 'Mission clôturée — prélèvement confirmé',
        message: `Votre mission ${mission.reference ?? ''} est définitivement clôturée. Prélèvement de ${montant.toLocaleString()} F confirmé.`,
        lien: `/missions/${missionId}`,
      })

      // Envoyer le rapport consolidé au DE et à la CAF
      const { data: gestionnaires } = await supabase
        .from('profiles').select('id').in('role', ['de', 'caf'])
      for (const g of gestionnaires ?? []) {
        await supabase.from('notifications').insert({
          user_id: g.id,
          titre: `Rapport consolidé — Mission ${mission.reference ?? missionId}`,
          message: msgComplet,
          lien: `/missions/${missionId}`,
        })
      }
    }
  }

  if (name === 'transaction.canceled' || name === 'transaction.declined') {
    await supabase
      .from('payments')
      .update({ status: 'echoue', raw_webhook: event })
      .eq('mission_id', missionId)
    // Repasser en paiement_attente pour permettre un retry
    await supabase.from('missions').update({ status: 'paiement_attente' }).eq('id', missionId)
  }

  return NextResponse.json({ received: true })
}
