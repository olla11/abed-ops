import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import HTMLtoDOCX from 'html-to-docx'
import { fixDocxSectionOrder } from '@/lib/docx-fix'

// Téléchargement du contenu actuel en .docx (menu "Fichier" de la barre
// d'outils), à côté du PDF — ouvert à tout utilisateur ayant accès au
// document (lecture RLS déjà ouverte sur demandes_signature).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: document } = await supabase
    .from('demandes_signature').select('titre, contenu_html').eq('id', id).eq('type', 'document_collaboratif').single()
  if (!document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  let docx: Buffer
  try {
    docx = await HTMLtoDOCX(document.contenu_html || '<p></p>', null, { title: document.titre, margins: { top: 1000, right: 1000, bottom: 1000, left: 1000 } })
    // html-to-docx place <w:sectPr> en premier enfant de <w:body> au lieu du
    // dernier comme l'exige le schéma OOXML — Word refuse sinon d'ouvrir le
    // fichier (voir docx-fix.ts pour le détail du diagnostic).
    docx = await fixDocxSectionOrder(docx)
  } catch (err) {
    console.error('[Documents] Erreur de génération .docx :', err)
    return NextResponse.json({ error: 'Impossible de générer le fichier Word.' }, { status: 500 })
  }

  const filename = `${document.titre.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'}.docx`
  return new NextResponse(new Uint8Array(docx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
