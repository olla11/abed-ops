import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { LOGO_PNG_B64 } from '@/lib/logo-b64'

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  if (!text) return ['']
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (lines.length >= maxLines) break
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word.slice(0, maxChars)
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines.length ? lines : ['']
}

// Cachet ovale officiel ABED — style de l'image de référence
function drawCachet(
  page: any,
  cx: number, cy: number,
  rx: number, ry: number, // demi-axes horizontal / vertical
  topText: string,        // texte sur l'arc supérieur
  centerLine1: string,    // ex: "Le Directeur"
  centerLine2: string,    // ex: "Exécutif"
  bottomText: string,     // ex: "*(ABED ONG)*"
  font: any,
  boldFont: any,
) {
  const red = rgb(0.75, 0.05, 0.05)

  // Ellipse extérieure
  page.drawEllipse({ x: cx, y: cy, xScale: rx, yScale: ry, borderColor: red, borderWidth: 2, color: rgb(1,1,1) })
  // Ellipse intérieure (double trait)
  page.drawEllipse({ x: cx, y: cy, xScale: rx - 6, yScale: ry - 6, borderColor: red, borderWidth: 0.8 })

  // Texte sur l'arc supérieur — caractère par caractère le long de l'ellipse
  const chars = topText.split('')
  // Arc de ~220° centré en haut (de ~160° à ~380° en notation standard)
  const arcSpan = Math.PI * 1.25
  const arcStart = Math.PI / 2 + arcSpan / 2
  const step = arcSpan / Math.max(chars.length - 1, 1)
  const tRx = rx - 11, tRy = ry - 11

  for (let i = 0; i < chars.length; i++) {
    const angle = arcStart - i * step
    const x = cx + tRx * Math.cos(angle)
    const y = cy + tRy * Math.sin(angle)
    // Rotation : tangente à l'ellipse en ce point, orientée vers l'extérieur
    const rot = (angle - Math.PI / 2) * 180 / Math.PI
    page.drawText(chars[i], { x: x - 3, y: y - 3.5, size: 5.5, font, color: red, rotate: degrees(rot) })
  }

  // Texte central (2 lignes) — gras
  const totalH = 10 * 2
  const startY = cy + totalH / 2 - 2
  ;[centerLine1, centerLine2].forEach((line, i) => {
    const w = boldFont.widthOfTextAtSize(line, 8)
    page.drawText(line, { x: cx - w / 2, y: startY - i * 11, size: 8, font: boldFont, color: red })
  })

  // Texte du bas (arc inférieur, centré)
  const bChars = bottomText.split('')
  const bArcSpan = Math.PI * 0.7
  const bArcStart = -Math.PI / 2 - bArcSpan / 2
  const bStep = bArcSpan / Math.max(bChars.length - 1, 1)
  for (let i = 0; i < bChars.length; i++) {
    const angle = bArcStart + i * bStep
    const x = cx + tRx * Math.cos(angle)
    const y = cy + tRy * Math.sin(angle)
    const rot = (angle + Math.PI / 2) * 180 / Math.PI
    page.drawText(bChars[i], { x: x - 3, y: y - 3.5, size: 5.5, font, color: red, rotate: degrees(rot) })
  }
}

// Signature illustrative (tracé SVG courbe simulant une signature manuscrite)
function drawSignature(page: any, x: number, y: number, color: any) {
  // Tracé SVG d'une signature stylisée (initiales + paraphe)
  const sig = [
    // Boucle initiale
    `M ${x} ${y+10} C ${x+5} ${y+20} ${x+15} ${y+22} ${x+18} ${y+12}`,
    // Trait montant
    `M ${x+18} ${y+12} C ${x+22} ${y+2} ${x+28} ${y+18} ${x+34} ${y+14}`,
    // Boucle centrale
    `M ${x+34} ${y+14} C ${x+40} ${y+10} ${x+44} ${y+20} ${x+50} ${y+16}`,
    // Trait long descendant
    `M ${x+50} ${y+16} C ${x+58} ${y+12} ${x+66} ${y+8} ${x+74} ${y+14}`,
    // Paraphe final
    `M ${x+74} ${y+14} C ${x+80} ${y+18} ${x+88} ${y+6} ${x+92} ${y+12}`,
    `M ${x+92} ${y+12} C ${x+96} ${y+16} ${x+98} ${y+10} ${x+100} ${y+13}`,
  ]
  for (const path of sig) {
    try {
      page.drawSvgPath(path, { borderColor: color, borderWidth: 1.2, color: rgb(0,0,0,0) })
    } catch { /* ignore si path non supporté */ }
  }
}

export async function GET(req: NextRequest) {
  const missionId = req.nextUrl.searchParams.get('missionId')
  if (!missionId) return NextResponse.json({ error: 'missionId requis' }, { status: 400 })

  const supabase = await createClient()
  const { data: m, error } = await supabase
    .from('missions')
    .select(`
      *,
      missionnaire:profiles!missions_missionnaire_id_fkey(
        nom, prenoms, ifu, fonction, grade_indice,
        adresse, date_naissance, lieu_naissance, nationalite,
        telephone, civilite
      ),
      signataire:profiles!missions_signe_par_fkey(nom, prenoms, fonction, role, civilite, signature_url, cachet_url)
    `)
    .eq('id', missionId)
    .single()

  if (error || !m) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (m.status === 'brouillon' || m.status === 'soumis') {
    return NextResponse.json({ error: 'OM non encore signe' }, { status: 403 })
  }

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  const green = rgb(0.18, 0.49, 0.20)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.45, 0.45, 0.45)

  const mn = m.missionnaire as any
  const sg = m.signataire as any

  let y = 810

  // ---- EN-TÊTE avec logo RGB couleur ----
  try {
    const logoBytes = Buffer.from(LOGO_PNG_B64, 'base64')
    const logoImg = await pdf.embedPng(logoBytes)
    const logoH = 72
    const logoW = logoImg.width * (logoH / logoImg.height)
    page.drawImage(logoImg, { x: 55, y: y - logoH + 10, width: logoW, height: logoH })

    // Bloc texte aligné à droite du logo
    const ox = 55 + logoW + 16
    const centerX = (ox + 540) / 2

    const lines: { text: string; size: number; isBold: boolean; color: any }[] = [
      { text: 'Agriculture pour le Bien-Etre et le Developpement Durable', size: 8.5, isBold: true, color: black },
      { text: '(ABED-ONG)', size: 9, isBold: true, color: black },
      { text: 'Enregistre sous le N° 2019-4/0008 /PDB/SG/SAG du 16 Janvier 2019', size: 7, isBold: false, color: gray },
      { text: 'Parakou – BENIN', size: 7.5, isBold: false, color: gray },
      { text: 'Tel. : +229 0167779141', size: 7.5, isBold: false, color: gray },
      { text: 'Email : contact@abedong.org  |  abedcontactpk@gmail.com', size: 7, isBold: false, color: gray },
    ]
    let ly = y + 4
    for (const l of lines) {
      const f = l.isBold ? bold : font
      const w = f.widthOfTextAtSize(l.text, l.size)
      page.drawText(l.text, { x: centerX - w / 2, y: ly, size: l.size, font: f, color: l.color })
      ly -= l.size + 3.5
    }

    y -= logoH + 8
  } catch (e) {
    page.drawText('ABED-ONG', { x: 55, y, size: 14, font: bold, color: green }); y -= 14
  }

  page.drawLine({ start: { x: 55, y }, end: { x: 540, y }, thickness: 1.5, color: green }); y -= 18

  page.drawText(`ORDRE DE MISSION N° : ${m.reference ?? '—'}`, {
    x: 55, y, size: 13, font: bold, color: black,
  }); y -= 14

  page.drawText(`Parakou, le ${fmt(m.signe_le)}`, { x: 370, y, size: 10, font, color: gray }); y -= 20

  const civSg = sg?.civilite === 'Mme' ? 'La Directrice Executive de ABED-ONG donne ordre a :' : 'Le Directeur Executif de ABED-ONG donne ordre a :'
  page.drawText(civSg, { x: 55, y, size: 10, font, color: black }); y -= 16

  // ---- MISSIONNAIRE ----
  const rows1: [string, string][] = [
    ['Nom & Prenoms',            `${mn?.prenoms ?? ''} ${mn?.nom ?? ''}`],
    ['Date de naissance',        `${fmt(mn?.date_naissance)}  a : ${mn?.lieu_naissance ?? '—'}`],
    ['Nationalite',              mn?.nationalite ?? '—'],
    ['Numero IFU',               mn?.ifu ?? '—'],
    ['Qualite / Grade / Indice', mn?.grade_indice ?? '—'],
    ['Fonction',                 mn?.fonction ?? '—'],
    ['Adresse',                  mn?.adresse ?? '—'],
    ['Telephone',                mn?.telephone ?? '—'],
  ]
  for (const [k, v] of rows1) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 220, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 4

  page.drawLine({ start: { x: 55, y: y+4 }, end: { x: 540, y: y+4 }, thickness: 0.5, color: gray }); y -= 10

  // ---- MISSION ----
  const objetLines = wrapText(m.objet, 52, 3)
  page.drawText('Objet de la mission', { x: 60, y, size: 9, font: bold, color: black })
  page.drawText(': ' + objetLines[0], { x: 220, y, size: 9, font, color: black })
  for (let i = 1; i < objetLines.length; i++) { y -= 12; page.drawText(objetLines[i], { x: 222, y, size: 9, font, color: black }) }
  y -= 14

  const rows2: [string, string][] = [
    ['Lieu',                  m.lieu],
    ['Moyen de transport',    m.moyen_transport ?? '—'],
    ['Conducteur a bord',     m.conducteur_a_bord || '—'],
    ['Imputation budgetaire', m.imputation ?? '—'],
  ]
  for (const [k, v] of rows2) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 220, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 4

  page.drawLine({ start: { x: 55, y: y+4 }, end: { x: 540, y: y+4 }, thickness: 0.5, color: gray }); y -= 10

  // ---- DATES ----
  const rows3: [string, string][] = [
    ["Depart de l'origine",     fmt(m.date_depart)],
    ['Arrivee a destination',    fmt(m.date_arrivee_destination)],
    ['Depart de la destination', fmt(m.date_depart_destination)],
    ["Retour a l'origine",       fmt(m.date_retour)],
  ]
  for (const [k, v] of rows3) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 220, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 10

  page.drawLine({ start: { x: 55, y: y+4 }, end: { x: 540, y: y+4 }, thickness: 0.5, color: gray }); y -= 12

  // ---- MENTION LÉGALE ----
  const mention = `Les autorites administratives et politiques sont priees de faciliter a ${mn?.prenoms ?? ''} ${mn?.nom ?? ''} l'accomplissement de sa mission.`
  page.drawText(mention, { x: 60, y, size: 9, font, color: black, maxWidth: 475, lineHeight: 13 })
  y -= 46  // 2 lignes de texte + marge

  // ---- Charger signature et cachet uploadés si disponibles ----
  let uploadedSigBytes: Uint8Array | null = null
  let uploadedCachetBytes: Uint8Array | null = null
  if (sg?.signature_url || sg?.cachet_url) {
    const adminStorage = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    if (sg.signature_url) {
      const { data } = await adminStorage.storage.from('assets').download(sg.signature_url)
      if (data) uploadedSigBytes = new Uint8Array(await data.arrayBuffer())
    }
    if (sg.cachet_url) {
      const { data } = await adminStorage.storage.from('assets').download(sg.cachet_url)
      if (data) uploadedCachetBytes = new Uint8Array(await data.arrayBuffer())
    }
  }

  // ---- BLOC SIGNATURE (gauche) + CACHET (droite) — côte à côte ----
  // Zone fixe : 110pt de hauteur, signature à gauche, cachet centré à droite
  const blockTop = y          // ligne de départ du bloc
  const sigX = 60
  const cachetCX = 415
  const cachetCY = blockTop - 45  // centre vertical du cachet dans le bloc

  // -- Colonne gauche : titre + signature + nom --
  let titreLabel = sg?.civilite === 'Mme' ? 'La Directrice Executive' : 'Le Directeur Executif'
  if (sg?.role === 'caf') titreLabel = sg?.civilite === 'Mme' ? 'La Directrice Executive P.O' : 'Le Directeur Executif P.O'
  page.drawText(titreLabel, { x: sigX, y: blockTop, size: 9, font: bold, color: black })

  // Signature (image ou dessin illustratif)
  const sigImageY = blockTop - 46  // bas de la zone signature
  if (uploadedSigBytes) {
    try {
      const sigImg = await pdf.embedPng(uploadedSigBytes)
      const sigH = 38, sigW = Math.min(sigImg.width * (sigH / sigImg.height), 180)
      page.drawImage(sigImg, { x: sigX, y: sigImageY, width: sigW, height: sigH })
    } catch {
      try {
        const sigImg = await pdf.embedJpg(uploadedSigBytes)
        const sigH = 38, sigW = Math.min(sigImg.width * (sigH / sigImg.height), 180)
        page.drawImage(sigImg, { x: sigX, y: sigImageY, width: sigW, height: sigH })
      } catch { /* fallback illustratif */ }
    }
  } else {
    drawSignature(page, sigX, blockTop - 14, rgb(0.20, 0.20, 0.60))
  }

  // Nom signataire souligné
  const sigName = `${sg?.prenoms ?? ''} ${sg?.nom ?? ''}`
  const nameW = boldItalic.widthOfTextAtSize(sigName, 10)
  const nameY = blockTop - 62
  page.drawText(sigName, { x: sigX, y: nameY, size: 10, font: boldItalic, color: black })
  page.drawLine({
    start: { x: sigX, y: nameY - 2 },
    end: { x: sigX + nameW, y: nameY - 2 },
    thickness: 0.8, color: black,
  })

  // -- Colonne droite : cachet --
  if (uploadedCachetBytes) {
    try {
      const cachetImg = await pdf.embedPng(uploadedCachetBytes)
      const cachetH = 90, cachetW = cachetImg.width * (cachetH / cachetImg.height)
      page.drawImage(cachetImg, { x: cachetCX - cachetW / 2, y: cachetCY - cachetH / 2, width: cachetW, height: cachetH })
    } catch {
      try {
        const cachetImg = await pdf.embedJpg(uploadedCachetBytes)
        const cachetH = 90, cachetW = cachetImg.width * (cachetH / cachetImg.height)
        page.drawImage(cachetImg, { x: cachetCX - cachetW / 2, y: cachetCY - cachetH / 2, width: cachetW, height: cachetH })
      } catch { /* fallback dessiné */ }
    }
  } else {
    drawCachet(
      page,
      cachetCX, cachetCY,
      78, 55,
      'AGRICULTURE POUR LE BIEN ETRE ET LE DEVELOPPEMENT DURABLE',
      'Le Directeur',
      sg?.civilite === 'Mme' ? 'Executive' : 'Executif',
      '* (ABED ONG) *',
      font, bold,
    )
  }

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OM_${m.reference ?? m.id}.pdf"`,
    },
  })
}
