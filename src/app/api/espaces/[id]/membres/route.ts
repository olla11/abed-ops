import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
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

  // RLS (espace_membres_insert) restreint l'invitation au créateur de l'espace.
  const { data, error } = await supabase.from('espace_membres').insert({
    espace_id: id,
    profile_id: body.profile_id,
    invited_by: user.id,
  }).select('id, profile_id, profile:profiles!espace_membres_profile_id_fkey(id, nom, prenoms, email)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification (in-app + email) au nouveau membre
  const profile = (data as any).profile as { id: string; nom: string; prenoms: string; email: string | null } | null
  const [{ data: espace }, { data: inviterProfile }] = await Promise.all([
    supabase.from('espaces').select('nom').eq('id', id).single(),
    supabase.from('profiles').select('prenoms, nom').eq('id', user.id).single(),
  ])
  const admin = createAdminClient()
  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: body.profile_id,
    titre: 'Ajouté à un espace',
    message: `${inviterProfile?.prenoms ?? 'Quelqu\'un'} vous a ajouté à l'espace « ${espace?.nom ?? ''} ».`,
    lien: '/projets',
  })
  if (notifErr) console.error(notifErr)

  if (profile?.email) {
    await sendEmail({
      to: profile.email,
      subject: `[My ABED] Vous avez été ajouté à l'espace ${espace?.nom ?? ''}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#16a34a">Nouvel espace de travail</h2>
          <p>Bonjour <strong>${profile.prenoms}</strong>,</p>
          <p><strong>${inviterProfile?.prenoms ?? 'Quelqu\'un'}</strong> vous a ajouté à l'espace <strong>${espace?.nom ?? ''}</strong> sur My ABED.</p>
          <p style="color:#6b7280;font-size:13px">Connectez-vous à My ABED pour voir les projets de cet espace.</p>
        </div>
      `,
    }).catch(console.error)
  }

  // On ne renvoie pas l'email au client (sécurité)
  return NextResponse.json({ data: { ...(data as any), profile: profile ? { id: profile.id, nom: profile.nom, prenoms: profile.prenoms } : null } })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.profile_id) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

  // RLS (espace_membres_delete) restreint le retrait au créateur de l'espace.
  const { data, error } = await supabase.from('espace_membres')
    .delete()
    .eq('espace_id', id)
    .eq('profile_id', body.profile_id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  return NextResponse.json({ ok: true })
}
