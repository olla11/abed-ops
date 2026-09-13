import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET ?annee=2026 — budget adopté vs dépenses réellement exécutées
// (depenses_executees, alimenté automatiquement par le "Marquer payé" AAF
// de Pay Roll), par code budgétaire et par trimestre. Équivalent en temps
// réel de la feuille Excel "📈 Exécution Financière".
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const annee = Number(req.nextUrl.searchParams.get('annee')) || new Date().getFullYear()

  const [{ data: codes }, { data: budgets }, { data: depenses }] = await Promise.all([
    supabase.from('codes_budgetaires').select('code, libelle, ordre').order('ordre'),
    supabase.from('budget_adopte').select('code_budgetaire, montant_annuel').eq('annee', annee),
    supabase.from('depenses_executees').select('code_budgetaire, montant, date_paiement')
      .gte('date_paiement', `${annee}-01-01`).lte('date_paiement', `${annee}-12-31`),
  ])

  const budgetParCode = Object.fromEntries((budgets ?? []).map(b => [b.code_budgetaire, Number(b.montant_annuel)]))

  const depenseParCode: Record<string, { total: number; parTrimestre: [number, number, number, number] }> = {}
  for (const d of depenses ?? []) {
    const code = d.code_budgetaire
    if (!code) continue
    if (!depenseParCode[code]) depenseParCode[code] = { total: 0, parTrimestre: [0, 0, 0, 0] }
    const trimestre = Math.floor((new Date(d.date_paiement).getMonth()) / 3)
    depenseParCode[code].total += Number(d.montant)
    depenseParCode[code].parTrimestre[trimestre] += Number(d.montant)
  }

  const lignes = (codes ?? []).map(c => {
    const budget = budgetParCode[c.code] ?? 0
    const dep = depenseParCode[c.code] ?? { total: 0, parTrimestre: [0, 0, 0, 0] }
    return {
      code: c.code,
      libelle: c.libelle,
      budgetAnnuel: budget,
      depenseT1: dep.parTrimestre[0],
      depenseT2: dep.parTrimestre[1],
      depenseT3: dep.parTrimestre[2],
      depenseT4: dep.parTrimestre[3],
      totalDepense: dep.total,
      disponible: budget - dep.total,
      pctExecution: budget > 0 ? (dep.total / budget) * 100 : 0,
    }
  })

  const totaux = {
    budgetAnnuel: lignes.reduce((s, l) => s + l.budgetAnnuel, 0),
    totalDepense: lignes.reduce((s, l) => s + l.totalDepense, 0),
    disponible: lignes.reduce((s, l) => s + l.disponible, 0),
  }

  return NextResponse.json({ annee, lignes, totaux })
}
