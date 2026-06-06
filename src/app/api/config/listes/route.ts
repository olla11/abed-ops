import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const TABLES: Record<string, string> = {
  departements: 'departements',
  codes_budgetaires: 'codes_budgetaires',
  projets: 'projets_programmes',
  natures: 'natures_depense',
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const type = req.nextUrl.searchParams.get('type')
  const table = TABLES[type ?? '']
  if (!table) return NextResponse.json({ error: 'type invalide' }, { status: 400 })

  const { data, error } = await supabase.from(table).select('*').order('ordre')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { type, ...fields } = body
  const table = TABLES[type ?? '']
  if (!table) return NextResponse.json({ error: 'type invalide' }, { status: 400 })

  const { error } = await supabase.from(table).insert(fields)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const type = req.nextUrl.searchParams.get('type')
  const id = req.nextUrl.searchParams.get('id')
  const table = TABLES[type ?? '']
  if (!table || !id) return NextResponse.json({ error: 'type et id requis' }, { status: 400 })

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
