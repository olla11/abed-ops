import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { LOGO_PNG_B64 } from '@/lib/logo-b64'

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'

// Découpe un texte en lignes de max maxChars caractères (max maxLines lignes)
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

// Dessine un cachet circulaire officiel en rouge
function drawCachet(
  page: ReturnType<PDFDocument['getPage']>,
  cx: number, cy: number, r: number,
  perimeterText: string,
  centerLine1: string,
  font: import('pdf-lib').PDFFont,
  boldFont: import('pdf-lib').PDFFont,
) {
  const red = rgb(0.8, 0.05, 0.05)
  // Cercle extérieur
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: red, borderWidth: 1.8, color: rgb(1, 1, 1) })
  // Cercle intérieur (double trait)
  page.drawCircle({ x: cx, y: cy, size: r - 5, borderColor: red, borderWidth: 0.6 })

  // Texte sur le périmètre (arc supérieur)
  const chars = perimeterText.split('')
  const totalAngle = Math.PI * 1.1 // ~200° pour l'arc supérieur
  const startAngle = Math.PI / 2 + totalAngle / 2
  const angleStep = totalAngle / Math.max(chars.length - 1, 1)
  const textR = r - 10

  for (let i = 0; i < chars.length; i++) {
    const angle = startAngle - i * angleStep
    const x = cx + textR * Math.cos(angle)
    const y = cy + textR * Math.sin(angle)
    const rot = (angle - Math.PI / 2) * 180 / Math.PI
    page.drawText(chars[i], {
      x: x - 3, y: y - 4,
      size: 5.5,
      font,
      color: red,
      rotate: degrees(rot),
    })
  }

  // Texte au centre
  const lines = centerLine1.split('\n')
  const lineH = 9
  const startY = cy + (lines.length - 1) * lineH / 2
  for (let i = 0; i < lines.length; i++) {
    const w = boldFont.widthOfTextAtSize(lines[i], 7)
    page.drawText(lines[i], {
      x: cx - w / 2,
      y: startY - i * lineH,
      size: 7,
      font: boldFont,
      color: red,
    })
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
      signataire:profiles!missions_signe_par_fkey(nom, prenoms, fonction, role, civilite)
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
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  const green = rgb(0.18, 0.49, 0.20)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.45, 0.45, 0.45)

  const mn = m.missionnaire as any
  const sg = m.signataire as any

  let y = 810

  // ---- EN-TÊTE avec logo base64 (fiable sur Vercel) ----
  try {
    const logoBytes = Buffer.from(LOGO_PNG_B64, 'base64')
    const logoImg = await pdf.embedPng(logoBytes)
    const logoH = 48
    const logoW = logoImg.width * (logoH / logoImg.height)
    page.drawImage(logoImg, { x: 55, y: y - logoH + 8, width: logoW, height: logoH })
    // Texte organisation à droite du logo
    const ox = 55 + logoW + 10
    page.drawText('AGRICULTURE POUR LE BIEN ETRE ET LE', { x: ox, y: y - 4, size: 7, font: bold, color: green })
    page.drawText('DEVELOPPEMENT DURABLE', { x: ox, y: y - 13, size: 7, font: bold, color: green })
    page.drawText('ABED-ONG', { x: ox, y: y - 26, size: 13, font: bold, color: green })
    page.drawText('Systeme de Gestion des Operations', { x: ox, y: y - 37, size: 6.5, font, color: gray })
    y -= logoH + 6
  } catch {
    page.drawText('AGRICULTURE POUR LE BIEN ETRE ET LE DEVELOPPEMENT DURABLE', {
      x: 55, y, size: 8, font: bold, color: green,
    }); y -= 13
    page.drawText('ABED-ONG', { x: 55, y, size: 14, font: bold, color: green }); y -= 10
  }

  page.drawLine({ start: { x: 55, y }, end: { x: 540, y }, thickness: 1.2, color: green }); y -= 18

  page.drawText(`ORDRE DE MISSION N° : ${m.reference ?? '—'}`, {
    x: 55, y, size: 13, font: bold, color: black,
  }); y -= 14

  page.drawText(`Parakou, le ${fmt(m.signe_le)}`, {
    x: 370, y, size: 10, font, color: gray,
  }); y -= 20

  // Civilité DE pour l'autorisation
  const civSg = sg?.civilite === 'Mme' ? 'La Directrice Executive' : 'Le Directeur Executif'
  page.drawText(`${civSg} de ABED-ONG donne ordre a :`,
    { x: 55, y, size: 10, font, color: black }
  ); y -= 16

  // ---- TABLEAU MISSIONNAIRE ----
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

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 10

  // ---- OBJET / LIEU (objet sur max 3 lignes) ----
  // Objet avec wrap
  const objetLines = wrapText(m.objet, 52, 3)
  page.drawText('Objet de la mission', { x: 60, y, size: 9, font: bold, color: black })
  page.drawText(': ' + objetLines[0], { x: 220, y, size: 9, font, color: black })
  for (let i = 1; i < objetLines.length; i++) {
    y -= 12
    page.drawText(objetLines[i], { x: 222, y, size: 9, font, color: black })
  }
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

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 10

  // ---- DATES DU VOYAGE ----
  const rows3: [string, string][] = [
    ['Depart de l\'origine',     fmt(m.date_depart)],
    ['Arrivee a destination',    fmt(m.date_arrivee_destination)],
    ['Depart de la destination', fmt(m.date_depart_destination)],
    ['Retour a l\'origine',      fmt(m.date_retour)],
  ]

  for (const [k, v] of rows3) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 220, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 10

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 12

  // ---- MENTION LÉGALE ----
  const mention = `Les autorites administratives et politiques sont priees de faciliter a ${mn?.prenoms ?? ''} ${mn?.nom ?? ''} l'accomplissement de sa mission.`
  page.drawText(mention, { x: 60, y, size: 9, font, color: black, maxWidth: 475, lineHeight: 13 })
  y -= 30

  // ---- SIGNATURE + CACHET (côte à côte) ----
  // Cachet rouge à gauche
  const cachetX = 120
  const cachetY = y - 30
  const cachetR = 48

  // Texte du périmètre = sigle développé ABED
  const perimeterText = 'AGRICULTURE POUR LE BIEN ETRE ET LE DEVELOPPEMENT DURABLE'
  // Centre : LE DIRECTEUR EXECUTIF ou LA DIRECTRICE EXECUTIVE selon civilité
  const civCenter = sg?.civilite === 'Mme'
    ? 'LA DIRECTRICE\nEXECUTIVE'
    : 'LE DIRECTEUR\nEXECUTIF'

  drawCachet(page, cachetX, cachetY, cachetR, perimeterText, civCenter, font, bold)

  // Signature à droite : nom stylisé
  const sigX = 310
  let sigY = y

  // Mention selon rôle du signataire
  let sigMention = 'Pour le Directeur Executif,'
  let sigTitle = sg?.fonction ?? ''

  if (sg?.role === 'caf') {
    sigMention = 'Pour le Directeur Executif,'
    sigTitle = 'Directeur Executif Int. et P.O'
  } else if (sg?.civilite === 'Mme') {
    sigMention = 'La Directrice Executive,'
  }

  page.drawText(sigMention, { x: sigX, y: sigY, size: 9, font, color: black }); sigY -= 14

  // Nom en signature stylisée (bold italic, plus grand)
  const sigName = `${sg?.prenoms ?? ''} ${sg?.nom ?? ''}`
  page.drawText(sigName, { x: sigX, y: sigY, size: 13, font: boldItalic, color: black }); sigY -= 14

  if (sigTitle) {
    page.drawText(sigTitle, { x: sigX, y: sigY, size: 8.5, font: italic, color: gray }); sigY -= 11
  }
  page.drawText('(Signe electroniquement)', { x: sigX, y: sigY, size: 7.5, font, color: gray })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OM_${m.reference ?? m.id}.pdf"`,
    },
  })
}
