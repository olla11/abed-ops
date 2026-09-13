import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET ?annee=2026 — tous les codes budgétaires avec leur montant adopté pour
// cette année (0 si pas encore saisi), pour l'écran de saisie CAF et pour le
// calcul de la "réalisation cumulée / disponibilité" sur l'appel de fonds.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const annee = Number(req.nextUrl.searchParams.get('annee')) || new Date().getFullYear()

  const [{ data: codes }, { data: budgets }] = await Promise.all([
    supabase.from('codes_budgetaires').select('code, libelle, ordre').order('ordre'),
    supabase.from('budget_adopte').select('code_budgetaire, montant_annuel, t1_montant, t2_montant, t3_montant, t4_montant').eq('annee', annee),
  ])

  const budgetsParCode = Object.fromEntries((budgets ?? []).map(b => [b.code_budgetaire, b]))
  const data = (codes ?? []).map(c => {
    const b = budgetsParCode[c.code]
    return {
      code: c.code,
      libelle: c.libelle,
      montant_annuel: Number(b?.montant_annuel ?? 0),
      t1_montant: b?.t1_montant !== null && b?.t1_montant !== undefined ? Number(b.t1_montant) : null,
      t2_montant: b?.t2_montant !== null && b?.t2_montant !== undefined ? Number(b.t2_montant) : null,
      t3_montant: b?.t3_montant !== null && b?.t3_montant !== undefined ? Number(b.t3_montant) : null,
      t4_montant: b?.t4_montant !== null && b?.t4_montant !== undefined ? Number(b.t4_montant) : null,
    }
  })

  return NextResponse.json({ annee, data })
}

// PUT { annee, code_budgetaire, montant_annuel } — CAF/admin uniquement.
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const { annee, code_budgetaire, montant_annuel } = await req.json()
  if (!annee || !code_budgetaire || montant_annuel === undefined) {
    return NextResponse.json({ error: 'annee, code_budgetaire et montant_annuel requis' }, { status: 400 })
  }

  const { error } = await supabase.from('budget_adopte')
    .upsert({ annee, code_budgetaire, montant_annuel, updated_at: new Date().toISOString() }, { onConflict: 'code_budgetaire,annee' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
