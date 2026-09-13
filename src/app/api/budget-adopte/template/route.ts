import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// GET ?annee=2027 — modèle Excel à remplir puis réimporter (voir
// /api/budget-adopte/import) : une ligne par code budgétaire existant, avec
// le montant annuel et sa répartition par trimestre déjà adoptés pour cette
// année pré-remplis s'ils existent (pratique pour corriger, pas seulement
// pour saisir une année vierge). Le total des 4 trimestres n'a pas à être
// égal au montant annuel colonne par colonne au moment de la saisie — c'est
// à la CAF de les faire correspondre, comme dans le document papier.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const annee = Number(req.nextUrl.searchParams.get('annee')) || new Date().getFullYear()

  const [{ data: codes }, { data: budgets }] = await Promise.all([
    supabase.from('codes_budgetaires').select('code, libelle').order('ordre'),
    supabase.from('budget_adopte').select('code_budgetaire, montant_annuel, t1_montant, t2_montant, t3_montant, t4_montant').eq('annee', annee),
  ])
  const budgetsParCode = Object.fromEntries((budgets ?? []).map(b => [b.code_budgetaire, b]))

  const rows = [
    ['Code', 'Libellé (ne pas modifier)', `Budget annuel ${annee} (FCFA)`, 'Budget T1 (FCFA)', 'Budget T2 (FCFA)', 'Budget T3 (FCFA)', 'Budget T4 (FCFA)'],
    ...(codes ?? []).map(c => {
      const b = budgetsParCode[c.code]
      return [c.code, c.libelle, Number(b?.montant_annuel ?? 0), b?.t1_montant ?? '', b?.t2_montant ?? '', b?.t3_montant ?? '', b?.t4_montant ?? '']
    }),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 10 }, { wch: 48 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
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
