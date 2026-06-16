import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const GREEN  = rgb(0.388, 0.647, 0.129)
const GRAY   = rgb(0.45, 0.45, 0.45)
const BLACK  = rgb(0, 0, 0)
const WHITE  = rgb(1, 1, 1)
const LGRAY  = rgb(0.85, 0.85, 0.85)
const LGREEN = rgb(0.94, 0.99, 0.90)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: rapport } = await supabase
    .from('rapports_allocations')
    .select(`*, prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom,prenoms,email,type_emploi,titre), manager:profiles!rapports_allocations_manager_id_fkey(nom,prenoms)`)
    .eq('id', id).single()

  if (!rapport) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const privilegedRoles = ['admin', 'caf', 'de', 'aaf', 'rh', 'administrateur', 'manager']
  const isPrivileged = privilegedRoles.includes(profile?.role ?? '')
  if (!isPrivileged && rapport.prestataire_id !== user.id) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  if (rapport.status !== 'autorise') return NextResponse.json({ error: 'Non encore autorisé' }, { status: 400 })

  const prest = rapport.prestataire as any
  const manager = rapport.manager as any
  const estSalarie = ['cdd', 'cdi'].includes(prest.type_emploi ?? '')
  const mois = new Date(rapport.periode_annee, rapport.periode_mois - 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const { width, height } = page.getSize()
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const normal = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let y = height - 40

  // ── Header ──
  page.drawRectangle({ x: 0, y: y - 10, width, height: 60, color: GREEN })
  page.drawText('ABED-ONG', { x: 40, y: y + 28, size: 22, font: bold, color: WHITE })
  page.drawText('AGRICULTURE POUR LE BIEN ÊTRE ET LE DÉVELOPPEMENT DURABLE',
    { x: 40, y: y + 12, size: 7, font: normal, color: rgb(0.9,0.9,0.9) })
  page.drawText('Système de Gestion des Opérations',
    { x: 40, y: y + 2, size: 7, font: normal, color: rgb(0.8,0.8,0.8) })
  y -= 55

  // ── Titre document ──
  const docTitle = estSalarie ? 'BULLETIN DE PAIE' : 'ÉTAT DE PAIEMENT — ALLOCATION MENSUELLE'
  y -= 24
  page.drawText(docTitle, { x: 40, y, size: 15, font: bold, color: GREEN })
  y -= 8
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1.5, color: GREEN })

  // ── Infos bénéficiaire ──
  y -= 26
  function row(label: string, value: string, isBold = false) {
    page.drawText(label, { x: 40, y, size: 10, font: normal, color: GRAY })
    page.drawText(value, { x: 220, y, size: 10, font: isBold ? bold : normal, color: BLACK })
    y -= 18
  }

  row('Employé(e) :', `${prest.prenoms} ${prest.nom}`, true)
  if (prest.titre) row('Fonction :', prest.titre.replace(/_/g, ' '))
  row('Type de contrat :', prest.type_emploi?.toUpperCase() ?? '—')
  row('Responsable :', `${manager.prenoms} ${manager.nom}`)
  row('Période :', mois, true)
  row('Date d\'autorisation :', new Date(rapport.de_le).toLocaleDateString('fr-FR'))

  y -= 8
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: LGRAY })

  if (estSalarie) {
    // ── Tableau fiche de paie ──
    y -= 20
    page.drawText('DÉTAIL DE LA RÉMUNÉRATION', { x: 40, y, size: 9, font: bold, color: GRAY })
    y -= 14

    // En-tête tableau
    page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 18, color: GREEN })
    page.drawText('Désignation', { x: 50, y: y + 1, size: 9, font: bold, color: WHITE })
    page.drawText('Montant (FCFA)', { x: width - 180, y: y + 1, size: 9, font: bold, color: WHITE })
    y -= 20

    function tableRow(label: string, value: string, shade = false) {
      if (shade) page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 18, color: rgb(0.97,0.97,0.97) })
      page.drawText(label, { x: 50, y: y + 1, size: 9, font: normal, color: BLACK })
      page.drawText(value, { x: width - 180, y: y + 1, size: 9, font: normal, color: BLACK })
      y -= 20
    }

    tableRow('Salaire de base / Rémunération brute', `${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA`, false)
    tableRow('Cotisations sociales', '0 FCFA (à la charge de l\'employeur)', true)
    tableRow('Retenues diverses', '0 FCFA', false)

    y -= 4
    // Ligne nette
    page.drawRectangle({ x: 40, y: y - 8, width: width - 80, height: 28, color: GREEN })
    page.drawText('NET À PAYER', { x: 50, y: y + 6, size: 11, font: bold, color: WHITE })
    page.drawText(`${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA`,
      { x: width - 190, y: y + 6, size: 12, font: bold, color: WHITE })
    y -= 32

  } else {
    // ── Bloc allocation simple ──
    y -= 20
    page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 52, color: LGREEN, borderColor: GREEN, borderWidth: 1.5 })
    page.drawText('MONTANT DE L\'ALLOCATION AUTORISÉE',
      { x: 56, y: y + 20, size: 9, font: bold, color: GREEN })
    page.drawText(`${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA`,
      { x: 56, y: y - 8, size: 22, font: bold, color: GREEN })
    y -= 40
  }

  // ── Rapport d'activité ──
  if (rapport.rapport_texte) {
    y -= 20
    page.drawText('Rapport d\'activité :', { x: 40, y, size: 10, font: bold, color: BLACK })
    y -= 16
    const words = rapport.rapport_texte.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (normal.widthOfTextAtSize(test, 9) > width - 100) {
        page.drawText(line, { x: 48, y, size: 9, font: normal, color: GRAY })
        y -= 14; line = word
        if (y < 160) break
      } else { line = test }
    }
    if (line && y > 160) {
      page.drawText(line, { x: 48, y, size: 9, font: normal, color: GRAY })
      y -= 14
    }
  }

  // ── Signatures ──
  y = Math.min(y - 30, 185)
  page.drawLine({ start: { x: 40, y: y + 12 }, end: { x: width - 40, y: y + 12 }, thickness: 0.5, color: LGRAY })
  page.drawText('Responsable technique', { x: 40, y, size: 9, font: normal, color: GRAY })
  page.drawText('Directeur Exécutif', { x: width / 2 + 20, y, size: 9, font: normal, color: GRAY })
  y -= 14
  page.drawText(`${manager.prenoms} ${manager.nom}`, { x: 40, y, size: 9, font: bold, color: BLACK })
  page.drawText(`Autorisé le ${new Date(rapport.de_le).toLocaleDateString('fr-FR')}`,
    { x: width / 2 + 20, y, size: 9, font: bold, color: BLACK })

  // ── Footer ──
  page.drawRectangle({ x: 0, y: 0, width, height: 36, color: rgb(0.97,0.97,0.97) })
  page.drawText(`Document généré le ${new Date().toLocaleDateString('fr-FR')} · ABED-ONG · contact@abedong.org · +229 0167779141`,
    { x: 40, y: 14, size: 7.5, font: normal, color: GRAY })

  const pdfBytes = await pdfDoc.save()
  const fileName = estSalarie
    ? `fiche-de-paie-${rapport.periode_mois}-${rapport.periode_annee}-${prest.nom}.pdf`
    : `etat-paiement-${rapport.periode_mois}-${rapport.periode_annee}-${prest.nom}.pdf`

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
