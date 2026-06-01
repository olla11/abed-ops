import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '-'

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
  const cursive = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const green = rgb(0.18, 0.49, 0.20)
  const black = rgb(0, 0, 0)
  const gray  = rgb(0.45, 0.45, 0.45)
  const bleu  = rgb(0.10, 0.30, 0.65)

  const mn = m.missionnaire
  const sg = m.signataire

  let y = 810

  // En-tete
  page.drawText('ASSOCIATION BENINOISE POUR L\'ENVIRONNEMENT ET LE DEVELOPPEMENT', {
    x: 55, y, size: 8, font: bold, color: green,
  }); y -= 13
  page.drawText('ABED-ONG', { x: 120, y, size: 14, font: bold, color: green }); y -= 10
  page.drawLine({ start: { x: 55, y }, end: { x: 540, y }, thickness: 1.2, color: green }); y -= 18

  page.drawText('ORDRE DE MISSION N° : ' + (m.reference ?? '-'), {
    x: 55, y, size: 13, font: bold, color: black,
  }); y -= 14

  page.drawText('Parakou, le ' + fmt(m.signe_le), {
    x: 380, y, size: 10, font, color: gray,
  }); y -= 20

  page.drawText('Le Directeur Executif de ABED-ONG donne ordre a :', {
    x: 55, y, size: 10, font, color: black,
  }); y -= 16

  // Bloc missionnaire
  const rows1: [string, string][] = [
    ['Nom & Prenoms',           (mn?.prenoms ?? '') + ' ' + (mn?.nom ?? '')],
    ['Date de naissance',       fmt(mn?.date_naissance) + '  -  Ne(e) a : ' + (mn?.lieu_naissance ?? '-')],
    ['Nationalite',             mn?.nationalite ?? '-'],
    ['Numero IFU',              mn?.ifu ?? '-'],
    ['Qualite / Grade / Indice', mn?.grade_indice ?? '-'],
    ['Fonction',                mn?.fonction ?? '-'],
    ['Adresse',                 mn?.adresse ?? '-'],
    ['Telephone',               mn?.telephone ?? '-'],
  ]
  for (const [k, v] of rows1) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 225, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 6

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 10

  // Bloc mission
  const rows2: [string, string][] = [
    ['Objet de la mission',    m.objet],
    ['Lieu',                   m.lieu],
    ['Moyen de transport',     m.moyen_transport ?? '-'],
    ['Conducteur a bord',      m.conducteur_a_bord || '-'],
    ['Imputation budgetaire',  m.imputation ?? '-'],
  ]
  for (const [k, v] of rows2) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 225, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 6

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 10

  // Dates du voyage
  const rows3: [string, string][] = [
    ['Depart de l\'origine',     fmt(m.date_depart)],
    ['Arrivee a destination',    fmt(m.date_arrivee_destination)],
    ['Depart de la destination', fmt(m.date_depart_destination)],
    ['Retour a l\'origine',      fmt(m.date_retour)],
  ]
  for (const [k, v] of rows3) {
    page.drawText(k, { x: 60, y, size: 9, font: bold, color: black })
    page.drawText(': ' + v, { x: 225, y, size: 9, font, color: black })
    y -= 14
  }
  y -= 14

  page.drawLine({ start: { x: 55, y: y + 4 }, end: { x: 540, y: y + 4 }, thickness: 0.5, color: gray })
  y -= 12

  const mention = 'Les autorites administratives et politiques sont priees de faciliter a ' +
    (mn?.prenoms ?? '') + ' ' + (mn?.nom ?? '') + ' l\'accomplissement de sa mission.'
  page.drawText(mention, { x: 60, y, size: 9, font, color: black, maxWidth: 475, lineHeight: 13 })
  y -= 28

  // Signature electronique + cachet
  const sigNom = ((sg?.prenoms ?? '') + ' ' + (sg?.nom ?? '')).trim()
  const sigFonction = sg?.fonction ?? 'Directeur Executif'
  const sigX = 340
  page.drawText('Pour le Directeur Executif,', { x: sigX, y, size: 9, font, color: black }); y -= 24
  // Signature manuscrite stylisee (nom en oblique, legerement incline visuellement)
  page.drawText(sigNom, { x: sigX, y, size: 18, font: cursive, color: bleu }); y -= 14
  page.drawLine({ start: { x: sigX, y: y + 4 }, end: { x: sigX + 160, y: y + 4 }, thickness: 0.6, color: gray })
  y -= 10
  page.drawText(sigNom, { x: sigX, y, size: 9, font: bold, color: black }); y -= 11
  page.drawText(sigFonction, { x: sigX, y, size: 8, font, color: gray }); y -= 10
  page.drawText('Signe electroniquement le ' + fmt(m.signe_le), { x: sigX, y, size: 7, font, color: gray })

  // Cachet circulaire bleu (a gauche de la signature)
  const cx = 180, cy = y + 45, r1 = 42, r2 = 35
  page.drawCircle({ x: cx, y: cy, size: r1, borderColor: bleu, borderWidth: 1.5, opacity: 0 })
  page.drawCircle({ x: cx, y: cy, size: r2, borderColor: bleu, borderWidth: 0.8, opacity: 0 })
  page.drawText('ABED-ONG', { x: cx - 24, y: cy + 8, size: 10, font: bold, color: bleu })
  page.drawText('* OFFICIEL *', { x: cx - 22, y: cy - 2, size: 7, font: bold, color: bleu })
  page.drawText('Parakou - Benin', { x: cx - 26, y: cy - 14, size: 6, font, color: bleu })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OM_${m.reference ?? m.id}.pdf"`,
    },
  })
}