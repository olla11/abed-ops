import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createMomoDebit } from '@/lib/fedapay'

// POST /api/missions/[id]/reconcile
// Le missionnaire valide son point financier.
// Si mission à charge partenaire -> déclenche le push MoMo des 20%.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json()
  const { point_financier, montant_recu, rapport } = body

  // 1. Enregistrer le point financier + rapport.
  //    Le trigger SQL recalcule total_depenses, prelevement_20 et solde.
  const { data: mission, error } = await supabase
    .from('missions')
    .update({
      point_financier,
      montant_recu,
      rapport,
      status: 'paiement_attente',
    })
    .eq('id', params.id)
    .eq('missionnaire_id', user.id)
    .select()
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: error?.message ?? 'mission introuvable' }, { status: 400 })
  }

  // 2. Pas de prélèvement si la mission n'est pas à charge d'un partenaire
  if (!mission.a_charge_partenaire || !mission.prelevement_20 || mission.prelevement_20 <= 0) {
    await supabase.from('missions').update({ status: 'cloture' }).eq('id', mission.id)
    return NextResponse.json({ ok: true, prelevement: 0, status: 'cloture' })
  }

  // 3. Récupérer le téléphone MoMo du missionnaire
  const { data: profile } = await supabase
    .from('profiles').select('telephone, nom, prenoms').eq('id', user.id).single()

  if (!profile?.telephone) {
    return NextResponse.json({ error: 'Numéro Mobile Money manquant dans le profil' }, { status: 400 })
  }

  // 4. Créer l'enregistrement de paiement
  await supabase.from('payments').insert({
    mission_id: mission.id,
    montant: mission.prelevement_20,
    telephone: profile.telephone,
    status: 'en_attente',
  })

  // 5. Déclencher le push MoMo via FedaPay
  try {
    const { fedapayTxId } = await createMomoDebit({
      montant: mission.prelevement_20,
      telephone: profile.telephone,
      description: `Prélèvement 20% mission ${mission.reference ?? mission.id}`,
      missionId: mission.id,
    })
    await supabase.from('payments')
      .update({ fedapay_tx_id: fedapayTxId })
      .eq('mission_id', mission.id)

    return NextResponse.json({
      ok: true,
      prelevement: mission.prelevement_20,
      message: 'Confirmez le paiement sur votre téléphone (MTN MoMo).',
    })
  } catch (e: any) {
    await supabase.from('payments').update({ status: 'echoue' }).eq('mission_id', mission.id)
    return NextResponse.json({ error: `Échec FedaPay: ${e.message}` }, { status: 502 })
  }
}
