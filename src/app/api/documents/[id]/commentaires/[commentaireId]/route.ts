import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Supprimer un commentaire — réservé à son propre auteur (comme pour les TDR).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; commentaireId: string }> }) {
  const { commentaireId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: existing } = await supabase.from('document_commentaires').select('auteur_id').eq('id', commentaireId).single()
  if (!existing) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })
  if (existing.auteur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Les réponses (parent_id) sont supprimées en cascade côté base.
  const { error } = await supabase.from('document_commentaires').delete().eq('id', commentaireId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
