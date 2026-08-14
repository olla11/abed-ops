import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { genererReconciliationPdf, nomFichierReconciliationPdf, RECONCILIATION_PDF_SELECT } from '@/lib/tdr-reconciliation-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

// Accès restreint comme le reste du dossier de suivi financier :
// AAF/CAF/DE/admin/superadmin, ou le responsable (initiateur) du TdR.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  const { data: tdr, error } = await supabase.from('tdrs').select(`${RECONCILIATION_PDF_SELECT}, initiateur_id, statut`).eq('id', id).single()
  if (error || !tdr) return NextResponse.json({ error: 'TdR introuvable ou accès refusé' }, { status: 404 })

  const accesAutorise = ['aaf', 'caf', 'de', 'admin', 'superadmin'].includes(role) || tdr.initiateur_id === user.id
  if (!accesAutorise) return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  if (tdr.statut !== 'cloture') return NextResponse.json({ error: 'Le rapport de réconciliation n\'est disponible qu\'une fois le TdR clôturé.' }, { status: 409 })

  const { data: factures } = await supabase
    .from('tdr_factures')
    .select('description, montant, date_facture, enregistre_par:profiles!tdr_factures_enregistre_par_fkey(nom, prenoms)')
    .eq('tdr_id', id)
    .order('date_facture', { ascending: true })

  const pdfBuffer = await genererReconciliationPdf(tdr as any, (factures ?? []) as any)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichierReconciliationPdf(tdr)}"`,
    },
  })
}
