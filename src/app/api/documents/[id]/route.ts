import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: document, error } = await supabase
    .from('demandes_signature')
    .select(`id, titre, description, statut, contenu_html, created_at, updated_at, createur_id,
      createur:profiles!demandes_signature_createur_id_fkey(id, nom, prenoms),
      participants:document_participants(id, profile_id, permission, profile:profiles!document_participants_profile_id_fkey(id, nom, prenoms))
    `)
    .eq('id', id).eq('type', 'document_collaboratif').single()

  if (error || !document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  // Voir page.tsx : RLS de `profiles` peut masquer un embed pour un rôle non
  // privilégié — on complète via l'annuaire, non restreint.
  if (!document.createur && document.createur_id) {
    const { data: annuaire } = await supabase.from('profiles_annuaire').select('id, nom, prenoms').eq('id', document.createur_id).maybeSingle()
    ;(document as any).createur = annuaire ?? null
  }

  return NextResponse.json({ data: document })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: document } = await supabase
    .from('demandes_signature')
    .select('id, createur_id, statut, type')
    .eq('id', id).eq('type', 'document_collaboratif').single()
  if (!document) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (document.statut !== 'revision') {
    return NextResponse.json({ error: "Ce document n'est plus modifiable (révision terminée)." }, { status: 409 })
  }

  const estCreateur = document.createur_id === user.id
  if (!estCreateur) {
    const { data: participation } = await supabase
      .from('document_participants').select('permission').eq('demande_id', id).eq('profile_id', user.id).maybeSingle()
    if (participation?.permission !== 'edition') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (typeof body?.contenu_html !== 'string') return NextResponse.json({ error: 'contenu_html requis' }, { status: 400 })

  const { error } = await supabase.from('demandes_signature')
    .update({ contenu_html: body.contenu_html, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
