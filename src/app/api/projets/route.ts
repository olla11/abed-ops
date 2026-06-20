import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('projets_internes')
    .select(`
      *,
      created_by_profile:profiles!projets_internes_created_by_fkey(nom, prenoms),
      activites(id, statut)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.nom?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const { data, error } = await supabase.from('projets_internes').insert({
    nom: body.nom.trim(),
    description: body.description?.trim() || null,
    statut: body.statut ?? 'en_cours',
    date_debut: body.date_debut || null,
    date_fin: body.date_fin || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
