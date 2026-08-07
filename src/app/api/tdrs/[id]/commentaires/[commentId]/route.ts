import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Modifier ou supprimer un commentaire — réservé à son propre auteur.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { commentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: existing } = await supabase.from('tdr_commentaires').select('auteur_id').eq('id', commentId).single()
  if (!existing) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })
  if (existing.auteur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const contenu = (body?.contenu ?? '').trim()
  if (!contenu) return NextResponse.json({ error: 'contenu est requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('tdr_commentaires')
    .update({ contenu })
    .eq('id', commentId)
    .select('id, chapitre_cle, mark_id, texte_cite, contenu, created_at, parent_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { commentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: existing } = await supabase.from('tdr_commentaires').select('auteur_id').eq('id', commentId).single()
  if (!existing) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })
  if (existing.auteur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Les réponses (parent_id) sont supprimées en cascade côté base.
  const { error } = await supabase.from('tdr_commentaires').delete().eq('id', commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
