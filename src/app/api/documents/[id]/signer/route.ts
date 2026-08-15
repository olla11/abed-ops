import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * Persiste le contenu après l'insertion d'un tampon de signature. Distinct
 * de PATCH /api/documents/[id] (réservé à ceux ayant la permission
 * 'edition') : signer ne demande aucun droit d'édition ni verrouillage
 * préalable — n'importe quel participant ajouté au document, quel que soit
 * son niveau d'accès, peut apposer sa signature à tout moment (voir le
 * bouton "Signer" de la barre d'outils). Le tampon a déjà été propagé en
 * temps réel aux autres participants connectés via Yjs ; cet appel ne fait
 * que sauvegarder l'instantané HTML côté serveur.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: document } = await supabase
    .from('demandes_signature').select('id, createur_id, statut').eq('id', id).eq('type', 'document_collaboratif').single()
  if (!document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (document.statut !== 'revision') {
    return NextResponse.json({ error: "Ce document n'est plus en révision." }, { status: 409 })
  }

  const estCreateur = document.createur_id === user.id
  if (!estCreateur) {
    const { data: participation } = await supabase
      .from('document_participants').select('id').eq('demande_id', id).eq('profile_id', user.id).maybeSingle()
    if (!participation) return NextResponse.json({ error: 'Accès réservé aux participants du document' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (typeof body?.contenu_html !== 'string') return NextResponse.json({ error: 'contenu_html requis' }, { status: 400 })

  const { error } = await supabase.from('demandes_signature')
    .update({ contenu_html: body.contenu_html, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
