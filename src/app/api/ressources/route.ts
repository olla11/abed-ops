import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

const CATEGORIES = ['guide', 'rapport', 'lien_usuel']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ressources')
    .select('id, categorie, titre, url, description, ordre, created_at')
    .order('categorie', { ascending: true })
    .order('ordre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ressources: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const categorie = body?.categorie
  const titre = (body?.titre ?? '').trim()
  const url = (body?.url ?? '').trim()
  const description = (body?.description ?? '').trim() || null

  if (!CATEGORIES.includes(categorie)) {
    return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
  }
  if (!titre || !url) {
    return NextResponse.json({ error: 'Titre et lien sont requis' }, { status: 400 })
  }
  if (!/^https?:\/\//.test(url) && !/^mailto:/.test(url)) {
    return NextResponse.json({ error: 'Le lien doit commencer par http(s):// ou mailto:' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { count } = await admin
    .from('ressources')
    .select('id', { count: 'exact', head: true })
    .eq('categorie', categorie)

  const { data, error } = await admin
    .from('ressources')
    .insert({ categorie, titre, url, description, ordre: count ?? 0, created_by: user.id })
    .select('id, categorie, titre, url, description, ordre, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ressource: data })
}
