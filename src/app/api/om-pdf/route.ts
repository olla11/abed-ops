import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// GET /api/om-pdf?missionId=...
// Génère le PDF de l'Ordre de Mission au format ABED-ONG.
export async function GET(req: NextRequest) {
  const missionId = req.nextUrl.searchParams.get('missionId')
  if (!missionId) return NextResponse.json({ error: 'missionId requis' }, { status: 400 })

  const supabase = createClient()
  const { data: m, error } = await supabase
    .from('missions')
    .select('*, missionnaire:profiles!missions_missionnaire_id_fkey(nom,prenoms,ifu,fonction), signataire:profiles!missions_signe_par_fkey(nom,prenoms,fonction)')
    .eq('id', missionId)
    .single()

  if (error || !m) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (m.status === 'brouillon' || m.status === 'soumis') {
    return NextResponse.json({ error: 'OM non encore signé' }, { status: 403 })
  }

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842]) // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const green = rgb(0.39, 0.65, 0.13)
  const black = rgb(0, 0, 0)

  let y = 800
  const draw = (t: string, x: number, size = 11, f = font, color = black) => {
    page.drawText(t, { x, y, size, font: f, color })
  }

  draw('DIRECTION EXECUTIVE', 200, 14, bold, green); y -= 30
  draw(`ORDRE DE MISSION N° : ${m.reference ?? '—'}`, 150, 12, bold); y -= 40
  draw(`Parakou, le ${new Date(m.signe_le).toLocaleDateString('fr-FR')}`, 350, 10); y -= 30
  draw('Le Directeur Exécutif de ABED-ONG ordonne à :', 60, 11); y -= 30

  const mn = m.missionnaire
  const rows: [string, string][] = [
    ['Nom', mn?.nom ?? ''],
    ['Prénoms', mn?.prenoms ?? ''],
    ['Numéro IFU', mn?.ifu ?? '—'],
    ['Fonction', mn?.fonction ?? ''],
    ['De se rendre à', m.lieu],
    ['Objet', m.objet],
    ['Moyen de transport', m.moyen_transport ?? ''],
    ['Date de départ', new Date(m.date_depart).toLocaleDateString('fr-FR')],
    ['Date de retour', new Date(m.date_retour).toLocaleDateString('fr-FR')],
    ['Frais imputables au', m.imputation ?? ''],
  ]
  for (const [k, v] of rows) {
    draw(k, 60, 10, bold)
    draw(': ' + v, 220, 10)
    y -= 24
  }

  y -= 30
  draw('Les autorités administratives et politiques sont priées de faciliter', 60, 10)
  y -= 16
  draw(`à ${mn?.prenoms} ${mn?.nom}, pour l'accomplissement de sa mission.`, 60, 10)
  y -= 50
  draw('Signé électroniquement par :', 330, 10)
  y -= 16
  draw(`${m.signataire?.prenoms ?? ''} ${m.signataire?.nom ?? ''}`, 330, 11, bold)
  y -= 14
  draw(m.signataire?.fonction ?? '', 330, 9)

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="OM_${m.reference ?? m.id}.pdf"`,
    },
  })
}
