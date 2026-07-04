import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createMomoDebit } from '@/lib/fedapay'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: mission } = await supabase
    .from('missions')
    .select('id, reference, missionnaire_id, prelevement_20, status, a_charge_partenaire')
    .eq('id', id).single()

  if (!mission) return NextResponse.json({ error: 'mission introuvable' }, { status: 404 })
  if (mission.missionnaire_id !== user.id) return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  if (!mission.a_charge_partenaire || !mission.prelevement_20 || mission.prelevement_20 <= 0) {
    return NextResponse.json({ error: 'Aucun prélèvement applicable.' }, { status: 400 })
  }
  if (!['paiement_attente', 'reconciliation'].includes(mission.status)) {
    return NextResponse.json({ error: 'Statut de mission incompatible avec un retry.' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('telephone, nom, prenoms').eq('id', user.id).single()

  if (!profile?.telephone) {
    return NextResponse.json({ error: 'Numéro Mobile Money manquant dans le profil.' }, { status: 400 })
  }

  // Marquer le paiement existant comme échoué
  await supabase.from('payments').update({ status: 'annule' }).eq('mission_id', id).eq('status', 'en_attente')

  // Créer une nouvelle tentative de paiement
  await supabase.from('payments').insert({
    mission_id: id,
    montant: mission.prelevement_20,
    telephone: profile.telephone,
    status: 'en_attente',
  })

  try {
    const { fedapayTxId, paymentUrl } = await createMomoDebit({
      montant: mission.prelevement_20,
      telephone: profile.telephone,
      description: `Prélèvement 20% mission ${mission.reference ?? id}`,
      missionId: id,
    })
    await supabase.from('payments').update({ fedapay_tx_id: fedapayTxId, status: 'en_attente' })
      .eq('mission_id', id).is('fedapay_tx_id', null)
    await supabase.from('missions').update({ status: 'paiement_attente' }).eq('id', id)

    return NextResponse.json({
      ok: true,
      paymentUrl,
      message: `Lien de paiement généré. Cliquez pour payer le prélèvement de ${Number(mission.prelevement_20).toLocaleString('fr-FR')} F CFA.`,
    })
  } catch (e: any) {
    await supabase.from('payments').update({ status: 'echoue' }).eq('mission_id', id).is('fedapay_tx_id', null)
    return NextResponse.json({ error: `Échec FedaPay: ${e.message}` }, { status: 502 })
  }
}
