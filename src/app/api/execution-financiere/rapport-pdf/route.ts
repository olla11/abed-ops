import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { calculerExecutionFinanciere } from '@/lib/execution-financiere'
import { genererExecutionFinancierePdf } from '@/lib/execution-financiere-pdf'

// GET ?annee=2026 — rapport PDF détaillé de l'exécution financière de
// l'année (graphique + tableau par ligne budgétaire + commentaires CAF par
// trimestre et annuel). CAF/AAF/DE/DP/admin/superadmin, comme la vue à
// l'écran.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'aaf', 'de', 'dp', 'administrateur', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const annee = Number(req.nextUrl.searchParams.get('annee')) || new Date().getFullYear()

  const [execution, { data: commentaires }] = await Promise.all([
    calculerExecutionFinanciere(supabase, annee),
    supabase.from('execution_financiere_commentaires').select('trimestre, commentaire').eq('annee', annee),
  ])

  const pdfBuffer = await genererExecutionFinancierePdf({
    annee, lignes: execution.lignes, totaux: execution.totaux, commentaires: commentaires ?? [],
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Rapport_execution_financiere_${annee}.pdf"`,
    },
  })
}
