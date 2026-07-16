import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { notifyTdr } from '@/lib/tdr-notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr } = await supabase.from('tdrs').select('initiateur_id, titre_activite').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })
  if (tdr.initiateur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const profileId = body?.profile_id
  const permission = body?.permission === 'revision' ? 'revision' : 'lecture'
  if (!profileId) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

  const { data, error } = await supabase.from('tdr_collaborateurs').insert({
    tdr_id: id,
    profile_id: profileId,
    permission,
    invited_by: user.id,
  }).select('id, profile_id, permission, profile:profiles!tdr_collaborateurs_profile_id_fkey(id, nom, prenoms)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyTdr(id, {
    titre: 'Invitation à collaborer sur un TDR',
    message: `Vous avez été ajouté au TDR « ${tdr.titre_activite} » en tant que collaborateur (${permission === 'revision' ? 'révision' : 'lecture'}).`,
    actionPourId: profileId,
    excludeId: user.id,
  }).catch(console.error)

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: tdr } = await supabase.from('tdrs').select('initiateur_id').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TDR introuvable' }, { status: 404 })
  if (tdr.initiateur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body?.profile_id) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

  const { error } = await supabase.from('tdr_collaborateurs').delete().eq('tdr_id', id).eq('profile_id', body.profile_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
