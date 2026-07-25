import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tdr_commentaires')
    .select('id, chapitre_cle, mark_id, texte_cite, contenu, created_at, parent_id, auteur:profiles!tdr_commentaires_auteur_id_fkey(id, nom, prenoms)')
    .eq('tdr_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const contenu = (body?.contenu ?? '').trim()
  const parentId = (body?.parent_id ?? '').trim() || null
  if (!contenu) {
    return NextResponse.json({ error: 'contenu est requis' }, { status: 400 })
  }

  let chapitreCle: string
  let markId: string
  let texteCite: string | null

  if (parentId) {
    // Une réponse hérite de l'ancrage (chapitre/sélection) du commentaire parent.
    const { data: parent } = await supabase
      .from('tdr_commentaires').select('chapitre_cle, mark_id').eq('id', parentId).eq('tdr_id', id).single()
    if (!parent) return NextResponse.json({ error: 'Commentaire parent introuvable' }, { status: 404 })
    chapitreCle = parent.chapitre_cle
    markId = parent.mark_id
    texteCite = null
  } else {
    chapitreCle = (body?.chapitre_cle ?? '').trim()
    markId = (body?.mark_id ?? '').trim()
    texteCite = (body?.texte_cite ?? '').trim().slice(0, 300) || null
    if (!chapitreCle || !markId) {
      return NextResponse.json({ error: 'chapitre_cle et mark_id sont requis' }, { status: 400 })
    }
  }

  const { data, error } = await supabase.from('tdr_commentaires').insert({
    tdr_id: id,
    chapitre_cle: chapitreCle,
    mark_id: markId,
    texte_cite: texteCite,
    contenu,
    auteur_id: user.id,
    parent_id: parentId,
  }).select('id, chapitre_cle, mark_id, texte_cite, contenu, created_at, parent_id, auteur:profiles!tdr_commentaires_auteur_id_fkey(id, nom, prenoms)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
