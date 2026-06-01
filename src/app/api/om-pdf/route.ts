import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'

// GET /api/om-pdf?missionId=...
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
        telephone
      ),
      signataire:profiles!missions_signe_par_fkey(nom, prenoms, fonction)
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
  const green = rgb(0.18, 0.49, 0.20)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.45, 0.45, 0.45)

  const mn = m.missionnaire
  const sg = m.signataire

  let y = 810

  // ---- EN-TETE ----
  let logoDrawn = false
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    const logoBytes = fs.readFileSync(logoPath)
    const logoImg = await pdf.embedPng(logoBytes)
    const logoDims = logoImg.scale(0.5)
    page.drawImage(logoImg, { x: 55, y: y - logoDims.height + 10, width: logoDims.width, height: logoDims.height })
    logoDrawn = true
    y -= logoDims.height + 4
  } catch {
    // Logo absent : en-tete texte
  }

  if (!logoDrawn) {
    page.drawText('ASSOCIATION BENINOISE POUR L\'ENVIRONNEMENT ET LE DEVELOPPEMENT', {
      x: 55, y, size: 8, font: bold, color: green,
    }); y -= 13
    page.drawText('ABED-ONG', { x: 55, y, size: 14, font: bold, color: green }); y -= 10
  }
  page.drawLine({ start: { x: 55, y }, end: { x: 540, y }, thickness: 1.2, color: green }); y -= 18

  page.drawText(`ORDRE DE MISSION N° : ${m.reference ?? '—'}`, {
    x: 55, y, size: 13, font: bold, color: black,
  }); y -= 14

  page.drawText(`Parakou, le ${fmt(m.signe_le)}`, {
    x: 380, y, size: 10, font, color: gray,
  }); y -= 20

  page.drawText(
    'Le Directeur Executif de ABED-ONG donne ordre a :',
    { x: 55, y, size: 10, font, color: black }
  ); y -= 16

  const rows1: [string, string][] = [
    ['Nom & Prenoms',            `${mn?.prenoms ?? ''} ${mn?.nom ?? ''}`],
    ['Date de naissance',        `${fmt(mn?.date_naissance)}  —  Ne(e) a : ${mn?.lieu_naissance ?? '—'}`],
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
  y -= 6

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 10

  const rows2: [string, string][] = [
    ['Objet de la mission',   m.objet],
    ['Lieu',                  m.lieu],
    ['Moyen de transport',    m.moyen_transport ?? '—'],
    ['Conducteur a bord',     m.conducteur_a_bord || '—'],
    ['Imputation budgetaire', m.imputation ?? '—'],
    ['Frais imputables au',   m.a_charge_partenaire ? 'Partenaire (prelevement 20 % applicable)' : 'ABED-ONG'],
  ]

  for (const [k, v] of rows2) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 220, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 6

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 10

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
  y -= 14

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 12

  const mention = `Les autorites administratives et politiques sont priees de faciliter a ${mn?.prenoms ?? ''} ${mn?.nom ?? ''} l'accomplissement de sa mission.`
  page.drawText(mention, { x: 60, y, size: 9, font, color: black, maxWidth: 475, lineHeight: 13 })
  y -= 26

  page.drawText('Pour le Directeur Executif,', { x: 340, y, size: 9, font, color: black }); y -= 13
  page.drawText(`${sg?.prenoms ?? ''} ${sg?.nom ?? ''}`, { x: 340, y, size: 10, font: bold, color: black }); y -= 12
  page.drawText(sg?.fonction ?? '', { x: 340, y, size: 9, font, color: gray }); y -= 10
  page.drawText('(Signe electroniquement)', { x: 340, y, size: 8, font, color: gray })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OM_${m.reference ?? m.id}.pdf"`,
    },
  })
}