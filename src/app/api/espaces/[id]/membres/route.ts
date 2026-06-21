import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('espace_membres')
    .select('id, profile_id, created_at, profile:profiles!espace_membres_profile_id_fkey(id, nom, prenoms)')
    .eq('espace_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.profile_id) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('espace_membres').insert({
    espace_id: id,
    profile_id: body.profile_id,
    invited_by: user.id,
  }).select('id, profile_id, profile:profiles!espace_membres_profile_id_fkey(id, nom, prenoms)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.profile_id) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('espace_membres')
    .delete()
    .eq('espace_id', id)
    .eq('profile_id', body.profile_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
