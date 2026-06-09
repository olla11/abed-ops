import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

async function checkCaf(supabase: any, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return ['caf', 'admin', 'administrateur'].includes(data?.role ?? '')
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('champs_demande')
    .select('*')
    .eq('actif', true)
    .order('ordre')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
  if (!await checkCaf(supabase, user.id)) return NextResponse.json({ error: 'accès refusé' }, { status: 403 })

  const body = await req.json()
  const { label, type, required, options, ordre } = body
  if (!label?.trim()) return NextResponse.json({ error: 'label requis' }, { status: 400 })

  const { error } = await supabase.from('champs_demande').insert({
    label: label.trim(),
    type: type ?? 'text',
    required: required ?? false,
    options: options ?? [],
    ordre: ordre ?? 0,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
  if (!await checkCaf(supabase, user.id)) return NextResponse.json({ error: 'accès refusé' }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabase.from('champs_demande').update(fields).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
  if (!await checkCaf(supabase, user.id)) return NextResponse.json({ error: 'accès refusé' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  // Soft delete pour ne pas perdre les données historiques
  const { error } = await supabase.from('champs_demande').update({ actif: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
