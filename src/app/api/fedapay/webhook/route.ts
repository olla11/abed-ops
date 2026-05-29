import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/fedapay'
import { createAdminClient } from '@/lib/supabase-server'

// FedaPay appelle cette route à chaque événement de transaction.
// On ne fait confiance QU'à ce webhook pour valider le paiement.
export async function POST(req: NextRequest) {
  const raw = await req.text()
  const signature = req.headers.get('x-fedapay-signature')

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 })
  }

  const event = JSON.parse(raw)
  const name: string = event.name || event.event // ex: "transaction.approved"
  const tx = event.entity || event.data?.object || {}
  const missionId = tx?.custom_metadata?.mission_id
  const txId = String(tx?.id ?? '')

  const supabase = createAdminClient()

  // Paiement réussi -> on clôture la mission
  if (name === 'transaction.approved') {
    await supabase
      .from('payments')
      .update({ status: 'reussi', confirmed_at: new Date().toISOString(), raw_webhook: event, fedapay_tx_id: txId })
      .eq('mission_id', missionId)

    await supabase
      .from('missions')
      .update({ status: 'cloture' })
      .eq('id', missionId)

    // Notifier le missionnaire
    const { data: mission } = await supabase
      .from('missions').select('missionnaire_id, reference').eq('id', missionId).single()
    if (mission) {
      await supabase.from('notifications').insert({
        user_id: mission.missionnaire_id,
        titre: 'Mission clôturée',
        message: `Le prélèvement de 20% a été confirmé. Votre mission ${mission.reference ?? ''} est définitivement validée.`,
        lien: `/missions/${missionId}`,
      })
    }
  }

  // Paiement échoué / annulé
  if (name === 'transaction.canceled' || name === 'transaction.declined') {
    await supabase
      .from('payments')
      .update({ status: 'echoue', raw_webhook: event })
      .eq('mission_id', missionId)
  }

  return NextResponse.json({ received: true })
}
