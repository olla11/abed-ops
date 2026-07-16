import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tdr_commentaires')
    .select('id, chapitre_cle, mark_id, texte_cite, contenu, created_at, auteur:profiles!tdr_commentaires_auteur_id_fkey(id, nom, prenoms)')
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
  const chapitreCle = (body?.chapitre_cle ?? '').trim()
  const markId = (body?.mark_id ?? '').trim()
  const contenu = (body?.contenu ?? '').trim()
  const texteCite = (body?.texte_cite ?? '').trim().slice(0, 300)
  if (!chapitreCle || !markId || !contenu) {
    return NextResponse.json({ error: 'chapitre_cle, mark_id et contenu sont requis' }, { status: 400 })
  }

  const { data, error } = await supabase.from('tdr_commentaires').insert({
    tdr_id: id,
    chapitre_cle: chapitreCle,
    mark_id: markId,
    texte_cite: texteCite || null,
    contenu,
    auteur_id: user.id,
  }).select('id, chapitre_cle, mark_id, texte_cite, contenu, created_at, auteur:profiles!tdr_commentaires_auteur_id_fkey(id, nom, prenoms)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
