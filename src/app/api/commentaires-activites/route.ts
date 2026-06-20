import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const activiteId = req.nextUrl.searchParams.get('activite_id')
  if (!activiteId) return NextResponse.json({ error: 'activite_id requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('commentaires_activites')
    .select('*, auteur:profiles!commentaires_activites_auteur_id_fkey(nom, prenoms, avatar_url)')
    .eq('activite_id', activiteId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.contenu?.trim() || !body?.activite_id) {
    return NextResponse.json({ error: 'contenu et activite_id requis' }, { status: 400 })
  }

  const { data, error } = await supabase.from('commentaires_activites').insert({
    activite_id: body.activite_id,
    contenu: body.contenu.trim(),
    auteur_id: user.id,
  }).select('*, auteur:profiles!commentaires_activites_auteur_id_fkey(nom, prenoms, avatar_url)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
