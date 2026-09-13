import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// GET ?annee=2027 — modèle Excel à remplir puis réimporter (voir
// /api/budget-adopte/import) : une ligne par code budgétaire existant,
// avec le montant déjà adopté pour cette année pré-rempli s'il existe déjà
// (pratique pour corriger, pas seulement pour saisir une année vierge).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const annee = Number(req.nextUrl.searchParams.get('annee')) || new Date().getFullYear()

  const [{ data: codes }, { data: budgets }] = await Promise.all([
    supabase.from('codes_budgetaires').select('code, libelle').order('ordre'),
    supabase.from('budget_adopte').select('code_budgetaire, montant_annuel').eq('annee', annee),
  ])
  const montants = Object.fromEntries((budgets ?? []).map(b => [b.code_budgetaire, Number(b.montant_annuel)]))

  const rows = [
    ['Code', 'Libellé (ne pas modifier)', `Montant annuel adopté ${annee} (FCFA)`],
    ...(codes ?? []).map(c => [c.code, c.libelle, montants[c.code] ?? 0]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 10 }, { wch: 48 }, { wch: 28 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Budget ${annee}`)
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Modele_Budget_Adopte_${annee}.xlsx"`,
    },
  })
}
