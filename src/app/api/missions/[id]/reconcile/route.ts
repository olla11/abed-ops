import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createMomoDebit } from '@/lib/fedapay'

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

  const { data: mission, error } = await supabase
    .from('missions')
    .update({
      point_financier,
      montant_recu: montant_recu ?? 0,
      rapport,
      mode_financement: mode_financement ?? null,
      status: 'reconciliation_caf',
    })
    .eq('id', id)
    .eq('missionnaire_id', user.id)
    .select()
    .single()

  if (error || !mission) {
    return NextResponse.json({ error: error?.message ?? 'mission introuvable' }, { status: 400 })
  }

  // Cas partenaire : prélèvement FedaPay
  if (mission.a_charge_partenaire && mission.prelevement_20 && mission.prelevement_20 > 0) {
    await supabase.from('missions').update({ status: 'paiement_attente' }).eq('id', id)

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
      return NextResponse.json({
        ok: true,
        prelevement: mission.prelevement_20,
        message: 'Confirmez le paiement sur votre téléphone (MTN MoMo).',
      })
    } catch (e: any) {
      await supabase.from('payments').update({ status: 'echoue' }).eq('mission_id', mission.id)
      await supabase.from('missions').update({ status: 'reconciliation' }).eq('id', id)
      return NextResponse.json({ error: `Échec FedaPay: ${e.message}` }, { status: 502 })
    }
  }

  // Cas non-partenaire : transmission au CAF pour validation
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
    prelevement: 0,
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
