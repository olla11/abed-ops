import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from "@/lib/supabase-server"
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { accordGenre, estFeminin } from '@/lib/genre'

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

  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabaseUser.from('profiles').select('role').eq('id', user.id).single()
  const privilegedRoles = ['admin', 'caf', 'de', 'dp', 'aaf', 'rh', 'administrateur', 'manager']
  const isPrivileged = privilegedRoles.includes(profile?.role ?? '')

  const admin = createAdminClient()
  const { data: m, error } = await admin
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

  // Vérification d'accès : rôle privilégié OU missionnaire de la mission
  if (!isPrivileged && m.missionnaire_id !== user.id) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  if (m.status === 'brouillon' || m.status === 'soumis') {
    return NextResponse.json({ error: 'OM non encore signé' }, { status: 403 })
  }

  // Récupère la civilité du DE pour accorder le titre P.O. quand le CAF signe
  const { data: deProfile } = await admin
    .from('profiles')
    .select('civilite')
    .eq('role', 'de')
    .single()
  const deCivilite = deProfile?.civilite ?? 'M.'

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  const green = rgb(0.18, 0.49, 0.20)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.45, 0.45, 0.45)

  // Marges 2.54 cm = 72 pt
  const ML = 72   // gauche
  const MR = 523  // droite (595 - 72)
  const MT = 770  // haut (842 - 72)
  const MB = 72   // bas
  const W = MR - ML  // largeur utile = 451

  const mn = m.missionnaire as any
  const sg = m.signataire as any

  let y = MT + 14  // on démarre un peu au-dessus de la marge pour le header

  // ---- EN-TÊTE ----
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logoabed2.png')
    const logoBytes = fs.readFileSync(logoPath)
    const logoImg = await pdf.embedPng(logoBytes)
    const logoH = 88
    const logoW = logoImg.width * (logoH / logoImg.height)
    page.drawImage(logoImg, { x: ML, y: y - logoH + 12, width: logoW, height: logoH })

    const ox = ML + logoW + 14
    const centerX = (ox + MR) / 2

    const lines: { text: string; size: number; isBold: boolean; color: any }[] = [
      { text: 'AGRICULTURE POUR LE BIEN-ÊTRE ET LE DÉVELOPPEMENT DURABLE', size: 9, isBold: true, color: black },
      { text: '(ABED-ONG)', size: 10.5, isBold: true, color: black },
      { text: 'Enregistré sous le N° 2019-4/0008 /PDB/SG/SAG du 16 Janvier 2019', size: 7.5, isBold: false, color: gray },
      { text: 'Parakou – BENIN', size: 8, isBold: false, color: gray },
      { text: 'Tel. : +229 0167779141', size: 8, isBold: false, color: gray },
      { text: 'Email : contact@abedong.org  |  abedcontactpk@gmail.com', size: 7.5, isBold: false, color: gray },
    ]
    let ly = y + 6
    for (const l of lines) {
      const f = l.isBold ? bold : font
      const w = f.widthOfTextAtSize(l.text, l.size)
      page.drawText(l.text, { x: centerX - w / 2, y: ly, size: l.size, font: f, color: l.color })
      ly -= l.size + 4
    }
    y -= logoH + 10
  } catch {
    page.drawText('ABED-ONG', { x: ML, y, size: 14, font: bold, color: green }); y -= 14
  }

  page.drawLine({ start: { x: ML, y }, end: { x: MR, y }, thickness: 1.5, color: green }); y -= 18

  page.drawText(`ORDRE DE MISSION N° : ${m.reference ?? '—'}`, {
    x: ML, y, size: 13, font: bold, color: black,
  }); y -= 14

  page.drawText(`Parakou, le ${fmt(m.signe_le)}`, { x: MR - 140, y, size: 10, font, color: gray }); y -= 20

  // Phrase d'ordre selon rôle du signataire
  let ordrePhrase: string
  if (sg?.role === 'administrateur') {
    const isFemme = estFeminin(sg?.civilite)
    const article = isFemme ? 'La' : 'Le'
    const fonctionSg = sg?.fonction ?? (isFemme ? "Administratrice" : "Administrateur")
    ordrePhrase = `${article} ${fonctionSg} de ABED-ONG donne ordre à :`
  } else if (sg?.role === 'caf') {
    // Quand le CAF signe P.O., la phrase reflète le genre du DE
    ordrePhrase = `${accordGenre(deCivilite, 'Le Directeur Exécutif', 'La Directrice Exécutive')} de ABED-ONG donne ordre à :`
  } else {
    ordrePhrase = `${accordGenre(sg?.civilite, 'Le Directeur Exécutif', 'La Directrice Exécutive')} de ABED-ONG donne ordre à :`
  }
  page.drawText(ordrePhrase, { x: ML, y, size: 10, font, color: black }); y -= 16

  // ---- MISSIONNAIRE ----
  const labelX = ML + 4
  const valX = ML + 152
  const rowSize = 9
  const rowStep = 14

  const rows1: [string, string][] = [
    ['Nom & Prénoms',            `${mn?.prenoms ?? ''} ${mn?.nom ?? ''}`],
    ['Date de naissance',        `${fmt(mn?.date_naissance)} à ${mn?.lieu_naissance ?? '—'}`],
    ['Nationalité',              mn?.nationalite ?? '—'],
    ['Numéro IFU',               mn?.ifu ?? '—'],
    ['Qualité / Grade / Indice', mn?.grade_indice ?? '—'],
    ['Fonction',                 mn?.fonction ?? '—'],
    ['Adresse',                  mn?.adresse ?? '—'],
    ['Téléphone',                mn?.telephone ?? '—'],
  ]
  for (const [k, v] of rows1) {
    page.drawText(k, { x: labelX, y, size: rowSize, font: bold, color: black })
    page.drawText(': ' + v, { x: valX, y, size: rowSize, font, color: black, maxWidth: MR - valX })
    y -= rowStep
  }
  y -= 4

  page.drawLine({ start: { x: ML, y: y+4 }, end: { x: MR, y: y+4 }, thickness: 0.5, color: gray }); y -= 10

  // ---- MISSION ----
  const objetLines = wrapText(m.objet, 52, 3)
  page.drawText('Objet de la mission', { x: labelX, y, size: rowSize, font: bold, color: black })
  page.drawText(': ' + objetLines[0], { x: valX, y, size: rowSize, font, color: black })
  for (let i = 1; i < objetLines.length; i++) { y -= 12; page.drawText(objetLines[i], { x: valX + 2, y, size: rowSize, font, color: black }) }
  y -= rowStep

  const rows2: [string, string][] = [
    ['Lieu',                  m.lieu],
    ['Moyen de transport',    m.moyen_transport ?? '—'],
    ['Conducteur à bord',     m.conducteur_a_bord || '—'],
    ['Imputation budgétaire', m.imputation || (!m.a_charge_partenaire ? 'ABED' : '—')],
  ]
  for (const [k, v] of rows2) {
    page.drawText(k, { x: labelX, y, size: rowSize, font: bold, color: black })
    page.drawText(': ' + v, { x: valX, y, size: rowSize, font, color: black })
    y -= rowStep
  }
  y -= 4

  page.drawLine({ start: { x: ML, y: y+4 }, end: { x: MR, y: y+4 }, thickness: 0.5, color: gray }); y -= 10

  // ---- DATES ----
  const rows3: [string, string][] = [
    ["Départ de l'origine",       fmt(m.date_depart)],
    ['Arrivée à destination',    fmt(m.date_arrivee_destination)],
    ['Départ de la destination', fmt(m.date_depart_destination)],
    ["Retour à l'origine",       fmt(m.date_retour)],
  ]
  for (const [k, v] of rows3) {
    page.drawText(k, { x: labelX, y, size: rowSize, font: bold, color: black })
    page.drawText(': ' + v, { x: valX, y, size: rowSize, font, color: black })
    y -= rowStep
  }
  y -= 10

  page.drawLine({ start: { x: ML, y: y+4 }, end: { x: MR, y: y+4 }, thickness: 0.5, color: gray }); y -= 12

  // ---- MENTION LÉGALE — nom en gras ----
  const nomMissionnaire = `${mn?.prenoms ?? ''} ${mn?.nom ?? ''}`
  const before = 'Les autorités administratives et politiques sont priées de faciliter à '
  const after = " l'accomplissement de sa mission."
  const beforeW = font.widthOfTextAtSize(before, rowSize)
  const nameW2 = bold.widthOfTextAtSize(nomMissionnaire, rowSize)
  page.drawText(before, { x: labelX, y, size: rowSize, font, color: black })
  page.drawText(nomMissionnaire, { x: labelX + beforeW, y, size: rowSize, font: bold, color: black })
  // si le nom dépasse la ligne, passer à la ligne suivante pour "after"
  const totalW = beforeW + nameW2 + font.widthOfTextAtSize(after, rowSize)
  if (totalW > W) {
    page.drawText(after, { x: labelX, y: y - 13, size: rowSize, font, color: black })
    y -= 13 * 2 + 14
  } else {
    page.drawText(after, { x: labelX + beforeW + nameW2, y, size: rowSize, font, color: black })
    y -= 30
  }

  // ---- Charger signature et cachet ----
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

  // ---- BLOC SIGNATURE (gauche) + CACHET (droite) ----
  const blockTop = y
  const sigX = ML
  const cachetCX = ML + W * 0.72
  const cachetCY = blockTop - 45

  // Titre signataire
  let titreLabel: string
  if (sg?.role === 'administrateur') {
    const isFemme = estFeminin(sg?.civilite)
    const article = isFemme ? 'La' : 'Le'
    const fonctionSg = sg?.fonction ?? (isFemme ? 'Administratrice' : 'Administrateur')
    titreLabel = `${article} ${fonctionSg}`
  } else if (sg?.role === 'caf') {
    // P.O. = Par Ordre du DE → accord selon la civilité du DE, pas du CAF
    titreLabel = `${accordGenre(deCivilite, 'Le Directeur Exécutif', 'La Directrice Exécutive')} et P.O`
  } else {
    titreLabel = accordGenre(sg?.civilite, 'Le Directeur Exécutif', 'La Directrice Exécutive')
  }
  page.drawText(titreLabel, { x: sigX, y: blockTop, size: 9, font: bold, color: black })

  // Signature — même hauteur que le cachet (90pt)
  const sigH = 90
  const sigImageY = blockTop - sigH - 2
  if (uploadedSigBytes) {
    try {
      const sigImg = await pdf.embedPng(uploadedSigBytes)
      const sigW = Math.min(sigImg.width * (sigH / sigImg.height), 180)
      page.drawImage(sigImg, { x: sigX, y: sigImageY, width: sigW, height: sigH })
    } catch {
      try {
        const sigImg = await pdf.embedJpg(uploadedSigBytes)
        const sigW = Math.min(sigImg.width * (sigH / sigImg.height), 180)
        page.drawImage(sigImg, { x: sigX, y: sigImageY, width: sigW, height: sigH })
      } catch { drawSignature(page, sigX, blockTop - 14, rgb(0.20, 0.20, 0.60)) }
    }
  } else {
    drawSignature(page, sigX, blockTop - 14, rgb(0.20, 0.20, 0.60))
  }

  // Nom signataire souligné
  const sigName = `${sg?.prenoms ?? ''} ${sg?.nom ?? ''}`
  const nameW = boldItalic.widthOfTextAtSize(sigName, 10)
  const nameY = blockTop - sigH - 16
  page.drawText(sigName, { x: sigX, y: nameY, size: 10, font: boldItalic, color: black })
  page.drawLine({ start: { x: sigX, y: nameY - 2 }, end: { x: sigX + nameW, y: nameY - 2 }, thickness: 0.8, color: black })

  // Cachet droite
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
    drawCachet(page, cachetCX, cachetCY, 78, 55,
      'AGRICULTURE POUR LE BIEN ÊTRE ET LE DÉVELOPPEMENT DURABLE',
      sg?.role === 'administrateur'
        ? accordGenre(sg?.civilite, "L'Administrateur", "L'Administratrice")
        : accordGenre(sg?.civilite, 'Le Directeur', 'La Directrice'),
      sg?.role === 'administrateur' ? '' : accordGenre(sg?.civilite, 'Exécutif', 'Exécutive'),
      '* (ABED ONG) *',
      font, bold,
    )
  }

  // ---- QR CODE — coin inférieur droit ----
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abedong.org'
    const qrUrl = `${appUrl}/verify/om/${missionId}`
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 120, margin: 1 })
    const qrBase64 = qrDataUrl.replace('data:image/png;base64,', '')
    const qrBytes = Buffer.from(qrBase64, 'base64')
    const qrImg = await pdf.embedPng(qrBytes)
    const qrSize = 64
    page.drawImage(qrImg, { x: MR - qrSize, y: MB - 4, width: qrSize, height: qrSize })
    const qrLabel = 'Vérifier en ligne'
    const qrLabelW = font.widthOfTextAtSize(qrLabel, 6)
    page.drawText(qrLabel, { x: MR - qrSize + (qrSize - qrLabelW) / 2, y: MB - 12, size: 6, font, color: gray })
  } catch (e) {
    console.error('[QR]', e)
  }

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OM_${m.reference ?? m.id}.pdf"`,
    },
  })
}
