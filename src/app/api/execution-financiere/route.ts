import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { calculerExecutionFinanciere } from '@/lib/execution-financiere'

// GET ?annee=2026 — budget adopté vs dépenses réellement exécutées, par code
// budgétaire et par trimestre. Équivalent en temps réel de la feuille Excel
// "📈 Exécution Financière".
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const annee = Number(req.nextUrl.searchParams.get('annee')) || new Date().getFullYear()
  const result = await calculerExecutionFinanciere(supabase, annee)
  return NextResponse.json(result)
}
