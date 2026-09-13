import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// PATCH { statut?, compte_bancaire_id?, code_budgetaire? } — CAF/admin
// uniquement. Ne permet jamais de passer à 'paye' ici : ce statut n'est
// atteignable que par l'AAF, ligne par ligne, une fois l'appel de fonds
// signé (voir la route dédiée à venir en Phase 4).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { data: item } = await supabase.from('pay_roll').select('id, statut, compte_bancaire_id').eq('id', id).single()
  if (!item) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (item.statut === 'paye') {
    return NextResponse.json({ error: 'Ce paiement est déjà marqué payé — non modifiable.' }, { status: 400 })
  }

  const body = await req.json()
  const update: Record<string, unknown> = {}

  if (body.code_budgetaire !== undefined) update.code_budgetaire = body.code_budgetaire || null
  if (body.compte_bancaire_id !== undefined) update.compte_bancaire_id = body.compte_bancaire_id || null

  if (body.statut !== undefined) {
    if (!['non_paye', 'a_payer'].includes(body.statut)) {
      return NextResponse.json({ error: 'statut invalide' }, { status: 400 })
    }
    if (body.statut === 'a_payer') {
      const compteFinal = update.compte_bancaire_id ?? item.compte_bancaire_id
      if (!compteFinal) {
        return NextResponse.json({ error: 'Choisissez un compte bancaire avant de passer à "À payer".' }, { status: 400 })
      }
    }
    update.statut = body.statut
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'aucune modification fournie' }, { status: 400 })
  }

  const { error } = await supabase.from('pay_roll').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
