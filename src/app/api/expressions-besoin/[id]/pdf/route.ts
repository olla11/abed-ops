import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { genererExpressionBesoinPdf, nomFichierExpressionBesoinPdf, type ExpressionBesoinPdfData } from '@/lib/expression-besoin-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: e, error } = await admin
    .from('expressions_besoin')
    .select('*, demandeur:profiles!expressions_besoin_demandeur_id_fkey(nom,prenoms), aaf:profiles!expressions_besoin_aaf_id_fkey(nom,prenoms), de:profiles!expressions_besoin_de_id_fkey(nom,prenoms)')
    .eq('id', id).single()

  if (error || !e) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const role = me?.role ?? ''
  const canView = e.demandeur_id === user.id || ['aaf', 'caf', 'de', 'admin', 'superadmin'].includes(role)
  if (!canView) return NextResponse.json({ error: 'accès refusé' }, { status: 403 })

  const aaf = e.aaf as { nom: string; prenoms: string } | null
  const de = e.de as { nom: string; prenoms: string } | null
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : null

  const pdfData: ExpressionBesoinPdfData = {
    numero: e.numero ?? e.id.slice(0, 8),
    date: new Date(e.created_at).toLocaleDateString('fr-FR'),
    projetService: e.projet_service,
    nomDemandeur: e.nom_demandeur,
    fonction: e.fonction,
    contact: e.contact,
    natureDepense: e.nature_depense,
    codeBudgetaire: e.code_budgetaire,
    refTdr: e.ref_tdr,
    lignes: (e.lignes ?? []).map((l: any) => ({
      designation: l.designation, quantite: l.quantite ?? '', montantEstime: Number(l.montant_estime) || 0, reference: l.reference ?? '',
    })),
    montantTotal: Number(e.montant_total) || 0,
    demandeurNom: e.nom_demandeur,
    demandeurLe: fmtDate(e.created_at),
    aafNom: aaf ? `${aaf.prenoms} ${aaf.nom}` : null,
    aafLe: fmtDate(e.aaf_le),
    deNom: de ? `${de.prenoms} ${de.nom}` : null,
    deLe: fmtDate(e.de_le),
  }

  const pdfBuffer = await genererExpressionBesoinPdf(pdfData)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichierExpressionBesoinPdf(pdfData.numero, id)}"`,
    },
  })
}
