import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) {
    return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  }
  return { user }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireManager()
  if (auth.error) return auth.error

  const body = await req.json().catch(() => null)
  const titre = (body?.titre ?? '').trim()
  const url = (body?.url ?? '').trim()
  const description = (body?.description ?? '').trim() || null

  if (!titre || !url) {
    return NextResponse.json({ error: 'Titre et lien sont requis' }, { status: 400 })
  }
  if (!/^https?:\/\//.test(url) && !/^mailto:/.test(url)) {
    return NextResponse.json({ error: 'Le lien doit commencer par http(s):// ou mailto:' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ressources')
    .update({ titre, url, description })
    .eq('id', id)
    .select('id, categorie, titre, url, description, ordre, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ressource: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireManager()
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { error } = await admin.from('ressources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
