import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { renderHtmlToPdf } from '@/lib/office-to-pdf'

// Téléchargement du contenu actuel en PDF, à la demande (menu "Fichier" de
// la barre d'outils) — ouvert à tout utilisateur ayant accès au document
// (lecture RLS déjà ouverte sur demandes_signature), pas seulement ceux qui
// peuvent l'éditer.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: document } = await supabase
    .from('demandes_signature').select('titre, contenu_html').eq('id', id).eq('type', 'document_collaboratif').single()
  if (!document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  let pdf: Buffer
  try {
    pdf = await renderHtmlToPdf(document.contenu_html || '<p></p>', document.titre)
  } catch (err) {
    console.error('[Documents] Erreur de rendu PDF (téléchargement) :', err)
    return NextResponse.json({ error: 'Impossible de générer le PDF.' }, { status: 500 })
  }

  const filename = `${document.titre.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
