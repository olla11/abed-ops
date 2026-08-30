import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { genererTdrPdf, nomFichierTdrPdf, TDR_PDF_SELECT } from '@/lib/tdr-pdf'

// Rendu via Chromium headless (au lieu du "Imprimer" du navigateur) — c'est
// le seul moyen d'obtenir un vrai fichier PDF avec marges/pagination fixées
// par le serveur : un numéro de page centré sur chaque page (Chrome
// n'autorise pas une page web à contrôler son propre pied de page pendant
// une impression déclenchée depuis le navigateur).
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const exclureCles = new Set((req.nextUrl.searchParams.get('exclure') ?? '').split(',').filter(Boolean))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  // Vérifie l'accès avec le client RLS (le RLS sur `tdrs` gère qui peut voir
  // quel TDR), puis recharge avec le client admin : le RLS sur `profiles`
  // masque les civilités/noms des autres personnes pour la plupart des
  // rôles, ce qui viderait à tort les blocs de signature (noms, accord de
  // genre CAF/DE/initiateur) dans le PDF.
  const { data: acces, error } = await supabase
    .from('tdrs')
    .select('id')
    .eq('id', id)
    .single()

  if (error || !acces) return NextResponse.json({ error: 'TdR introuvable ou accès refusé' }, { status: 404 })

  const admin = createAdminClient()
  const { data: tdr, error: erreurTdr } = await admin
    .from('tdrs')
    .select(TDR_PDF_SELECT)
    .eq('id', id)
    .single()

  if (erreurTdr || !tdr) return NextResponse.json({ error: 'TdR introuvable ou accès refusé' }, { status: 404 })

  const pdfBuffer = await genererTdrPdf(tdr, exclureCles)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nomFichierTdrPdf(tdr)}"`,
    },
  })
}
