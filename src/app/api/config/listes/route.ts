import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { estRH } from '@/lib/roles'

const TABLES: Record<string, string> = {
  departements: 'departements',
  codes_budgetaires: 'codes_budgetaires',
  projets: 'projets_programmes',
  natures: 'natures_depense',
  directions: 'directions',
  comptes_bancaires: 'comptes_bancaires',
}

// La liste "directions" (organigramme RH) est gérée par RH ; les autres
// listes (budgétaires) restent réservées à CAF/admin.
function canWrite(type: string, role: string | undefined): boolean {
  if (type === 'directions') return estRH(role) || role === 'admin'
  return ['caf', 'admin'].includes(role ?? '')
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type')
  const table = TABLES[type ?? '']
  if (!table) return NextResponse.json({ error: 'type invalide' }, { status: 400 })

  const { data, error } = await supabase.from(table).select('*').order('ordre')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Les formulaires (demande de paiement, Pay Roll) ne doivent proposer que
  // les codes budgétaires effectivement inscrits au budget adopté de
  // l'année en cours — pas tout l'historique jamais créé dans Paramètres.
  // Tant qu'aucun budget n'a encore été chargé pour la nouvelle année (début
  // d'année, avant l'upload de la CAF), on retombe sur la liste complète
  // plutôt que de laisser un formulaire sans aucun code proposé.
  if (type === 'codes_budgetaires' && req.nextUrl.searchParams.get('actifs') === '1') {
    const annee = new Date().getFullYear()
    const { data: budgets } = await supabase.from('budget_adopte').select('code_budgetaire').eq('annee', annee)
    const codesActifs = new Set((budgets ?? []).map(b => b.code_budgetaire))
    if (codesActifs.size > 0) {
      return NextResponse.json({ data: (data ?? []).filter((c: { code: string }) => codesActifs.has(c.code)) })
    }
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const body = await req.json()
  const { type, ...fields } = body
  const table = TABLES[type ?? '']
  if (!table) return NextResponse.json({ error: 'type invalide' }, { status: 400 })
  if (!canWrite(type, profile?.role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { error } = await supabase.from(table).insert(fields)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const type = req.nextUrl.searchParams.get('type')
  const id = req.nextUrl.searchParams.get('id')
  const table = TABLES[type ?? '']
  if (!table || !id) return NextResponse.json({ error: 'type et id requis' }, { status: 400 })
  if (!canWrite(type ?? '', profile?.role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
