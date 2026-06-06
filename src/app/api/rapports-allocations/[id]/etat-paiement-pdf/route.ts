import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

function colorGreen() { return rgb(0.388, 0.647, 0.129) }
function colorGray()  { return rgb(0.45, 0.45, 0.45) }
function colorBlack() { return rgb(0, 0, 0) }

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
    .select(`
      *,
      prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom,prenoms,email,type_emploi),
      manager:profiles!rapports_allocations_manager_id_fkey(nom,prenoms)
    `)
    .eq('id', id).single()

  if (!rapport) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (rapport.status !== 'autorise') {
    return NextResponse.json({ error: 'Rapport non encore autorisé' }, { status: 400 })
  }

  const prest = rapport.prestataire as any
  const manager = rapport.manager as any
  const mois = new Date(rapport.periode_annee, rapport.periode_mois - 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let y = height - 40

  // Header band
  page.drawRectangle({ x: 0, y: y - 10, width, height: 60, color: colorGreen() })
  page.drawText('ABED-ONG', { x: 40, y: y + 28, size: 22, font: fontBold, color: rgb(1,1,1) })
  page.drawText('AGRICULTURE POUR LE BIEN ÊTRE ET LE DÉVELOPPEMENT DURABLE',
    { x: 40, y: y + 12, size: 7, font: fontNormal, color: rgb(1,1,1) })
  page.drawText('Système de Gestion des Opérations',
    { x: 40, y: y + 2, size: 7, font: fontNormal, color: rgb(0.9,0.9,0.9) })
  y -= 50

  // Title
  y -= 30
  page.drawText('ÉTAT DE PAIEMENT — ALLOCATION MENSUELLE', {
    x: 40, y, size: 15, font: fontBold, color: colorGreen()
  })

  y -= 8
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1.5, color: colorGreen() })

  // Info section
  y -= 28
  const leftX = 40
  const valX = 220

  function row(label: string, value: string, bold = false) {
    page.drawText(label, { x: leftX, y, size: 10, font: fontNormal, color: colorGray() })
    page.drawText(value, { x: valX, y, size: 10, font: bold ? fontBold : fontNormal, color: colorBlack() })
    y -= 18
  }

  row('Bénéficiaire :', `${prest.prenoms} ${prest.nom}`, true)
  row('Type de contrat :', prest.type_emploi?.replace(/_/g, ' ') ?? '—')
  row('Responsable :', `${manager.prenoms} ${manager.nom}`)
  row('Période :', mois, true)
  row('Date d\'autorisation :', new Date(rapport.de_le).toLocaleDateString('fr-FR'))

  y -= 10
  page.drawLine({ start: { x: leftX, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.85,0.85,0.85) })

  // Montant box
  y -= 30
  page.drawRectangle({ x: leftX, y: y - 16, width: width - 80, height: 52, color: rgb(0.94, 0.99, 0.90), borderColor: colorGreen(), borderWidth: 1.5 })
  page.drawText('MONTANT DE L\'ALLOCATION AUTORISÉE', {
    x: leftX + 16, y: y + 20, size: 9, font: fontBold, color: colorGreen()
  })
  page.drawText(`${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA`, {
    x: leftX + 16, y: y - 8, size: 22, font: fontBold, color: colorGreen()
  })
  y -= 40

  // Rapport texte
  if (rapport.rapport_texte) {
    y -= 24
    page.drawText('Rapport d\'activités :', { x: leftX, y, size: 10, font: fontBold, color: colorBlack() })
    y -= 16
    const words = rapport.rapport_texte.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      const w = fontNormal.widthOfTextAtSize(test, 9)
      if (w > width - 100) {
        page.drawText(line, { x: leftX + 8, y, size: 9, font: fontNormal, color: colorGray() })
        y -= 14
        line = word
        if (y < 160) break
      } else {
        line = test
      }
    }
    if (line) {
      page.drawText(line, { x: leftX + 8, y, size: 9, font: fontNormal, color: colorGray() })
      y -= 14
    }
  }

  // Signatures
  y = Math.min(y - 30, 200)
  page.drawLine({ start: { x: leftX, y: y + 10 }, end: { x: width - 40, y: y + 10 }, thickness: 0.5, color: rgb(0.85,0.85,0.85) })
  y -= 10

  const sig1X = leftX
  const sig2X = width / 2 + 20

  page.drawText('Responsable technique', { x: sig1X, y, size: 9, font: fontNormal, color: colorGray() })
  page.drawText('Directeur Exécutif / DE', { x: sig2X, y, size: 9, font: fontNormal, color: colorGray() })
  y -= 14
  page.drawText(`${manager.prenoms} ${manager.nom}`, { x: sig1X, y, size: 9, font: fontBold, color: colorBlack() })
  page.drawText('Autorisé le ' + new Date(rapport.de_le).toLocaleDateString('fr-FR'),
    { x: sig2X, y, size: 9, font: fontBold, color: colorBlack() })

  // Footer
  y = 40
  page.drawRectangle({ x: 0, y: 0, width, height: 36, color: rgb(0.97, 0.97, 0.97) })
  page.drawText(`Document généré le ${new Date().toLocaleDateString('fr-FR')} · ABED-ONG · contact@abedong.org · +229 0167779141`,
    { x: 40, y: 14, size: 7.5, font: fontNormal, color: colorGray() })

  const pdfBytes = await pdfDoc.save()
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="etat-paiement-${rapport.periode_mois}-${rapport.periode_annee}-${prest.nom}.pdf"`,
    },
  })
}
