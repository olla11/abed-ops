import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { genererTdrPdf, nomFichierTdrPdf, TDR_PDF_SELECT } from '@/lib/tdr-pdf'
import { genererReconciliationPdf, nomFichierReconciliationPdf } from '@/lib/tdr-reconciliation-pdf'
import JSZip from 'jszip'

export const runtime = 'nodejs'
export const maxDuration = 60

function nomFichierSur(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_.]/g, '_').slice(0, 80)
}

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Archive complète d'un TdR clôturé (AAF, CAF, DE, admin, ou le responsable) :
// le TdR en PDF, le rapport de réconciliation en PDF, un récapitulatif CSV
// des factures et chacun de leurs justificatifs — pour un classement/archivage
// hors de l'application.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  const admin = createAdminClient()
  // TDR_PDF_SELECT part de `*` (couvre déjà toutes les colonnes scalaires
  // dont RECONCILIATION_PDF_SELECT a besoin) et embarque déjà `initiateur` —
  // on n'y ajoute que les deux embeds propres au rapport de réconciliation,
  // pour éviter un alias `initiateur` dupliqué entre les deux select.
  const { data: tdr } = await admin.from('tdrs')
    .select(`${TDR_PDF_SELECT},
      reconciliation_soumis_par_profile:profiles!tdrs_reconciliation_soumis_par_fkey(nom, prenoms),
      reconciliation_caf_signe_par_profile:profiles!tdrs_reconciliation_caf_signe_par_fkey(nom, prenoms)
    `)
    .eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })

  // Archive complète : réservée à AAF/CAF/DE uniquement — pas d'exception
  // admin/superadmin, pas d'accès pour le responsable du TdR.
  if (!['aaf', 'caf', 'de'].includes(role)) {
    return NextResponse.json({ error: 'accès réservé à l\'AAF, au CAF et au DE' }, { status: 403 })
  }
  if ((tdr as any).statut !== 'cloture') {
    return NextResponse.json({ error: "L'archive complète n'est disponible qu'une fois le TdR clôturé." }, { status: 409 })
  }

  const { data: factures } = await admin
    .from('tdr_factures')
    .select('description, montant, date_facture, fichier_url, enregistre_par:profiles!tdr_factures_enregistre_par_fkey(nom, prenoms)')
    .eq('tdr_id', id)
    .order('date_facture', { ascending: true })

  const zip = new JSZip()

  const [tdrPdf, reconciliationPdf] = await Promise.all([
    genererTdrPdf(tdr as any).catch(e => { console.error('[archive-zip] échec PDF TdR:', e); return null }),
    genererReconciliationPdf(tdr as any, (factures ?? []) as any).catch(e => { console.error('[archive-zip] échec PDF réconciliation:', e); return null }),
  ])
  if (tdrPdf) zip.file(nomFichierTdrPdf(tdr as any), tdrPdf)
  if (reconciliationPdf) zip.file(nomFichierReconciliationPdf(tdr as any), reconciliationPdf)

  const lignesCsv = ['Description,Date,Enregistrée par,Montant (FCFA),Justificatif']
  let i = 0
  for (const f of factures ?? []) {
    i++
    const enregistrePar = f.enregistre_par ? `${(f.enregistre_par as any).prenoms} ${(f.enregistre_par as any).nom}` : ''
    let nomJustificatif = ''
    if (f.fichier_url) {
      const { data: blob, error } = await admin.storage.from('timesheets').download(f.fichier_url)
      if (!error && blob) {
        const ext = f.fichier_url.split('.').pop() ?? 'bin'
        nomJustificatif = `${String(i).padStart(2, '0')}_${nomFichierSur(f.description)}.${ext}`
        zip.file(`Factures/${nomJustificatif}`, Buffer.from(await blob.arrayBuffer()))
      } else if (error) {
        console.error('[archive-zip] échec téléchargement justificatif:', f.fichier_url, error)
      }
    }
    lignesCsv.push([
      csvCell(f.description), csvCell(f.date_facture), csvCell(enregistrePar), csvCell(f.montant), csvCell(nomJustificatif),
    ].join(','))
  }
  zip.file('Factures/factures.csv', lignesCsv.join('\n'))

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const nomZip = `Archive-TdR-${((tdr as any).numero ?? id).replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomZip}"`,
    },
  })
}
