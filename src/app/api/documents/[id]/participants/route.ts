import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

async function estCreateur(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase.from('demandes_signature').select('id, titre, createur_id').eq('id', id).eq('type', 'document_collaboratif').single()
  if (!data) return { ok: false as const, error: 'Document introuvable', status: 404 }
  if (data.createur_id !== userId) return { ok: false as const, error: 'Accès réservé au créateur du document', status: 403 }
  return { ok: true as const, document: data }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const check = await estCreateur(supabase, id, user.id)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await req.json().catch(() => null)
  const profileId = (body?.profile_id ?? '').trim()
  const permission = ['lecture', 'commentaire', 'edition'].includes(body?.permission) ? body.permission : 'lecture'
  if (!profileId) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('document_participants').upsert(
    { demande_id: id, profile_id: profileId, permission, invited_by: user.id },
    { onConflict: 'demande_id,profile_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  after(async () => {
    const { data: profile } = await admin.from('profiles').select('nom, prenoms, email').eq('id', profileId).single()
    if (!profile) return
    await admin.from('notifications').insert({
      user_id: profileId,
      titre: 'Invitation à réviser un document',
      message: `${check.document.titre} vous a été partagé pour révision.`,
      lien: `/documents/${id}`,
    })
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const check = await estCreateur(supabase, id, user.id)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await req.json().catch(() => null)
  const profileId = (body?.profile_id ?? '').trim()
  if (!profileId) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })
  if (profileId === user.id) return NextResponse.json({ error: 'Vous ne pouvez pas vous retirer vous-même.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('document_participants').delete().eq('demande_id', id).eq('profile_id', profileId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
