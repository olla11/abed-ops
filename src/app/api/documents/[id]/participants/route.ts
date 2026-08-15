import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'
const PERMISSION_LABELS: Record<string, string> = { lecture: 'lecture', commentaire: 'commentaire', edition: 'édition' }

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

  // Distingue un premier ajout d'un simple changement de niveau d'accès —
  // le message envoyé (notif + email) est adapté en conséquence.
  const { data: existing } = await admin
    .from('document_participants').select('permission').eq('demande_id', id).eq('profile_id', profileId).maybeSingle()
  const estNouveau = !existing
  if (existing?.permission === permission) return NextResponse.json({ ok: true })

  const { error } = await admin.from('document_participants').upsert(
    { demande_id: id, profile_id: profileId, permission, invited_by: user.id },
    { onConflict: 'demande_id,profile_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  after(async () => {
    const { data: profile } = await admin.from('profiles').select('nom, prenoms, email').eq('id', profileId).single()
    if (!profile) return
    const niveau = PERMISSION_LABELS[permission] ?? permission
    const titre = estNouveau ? 'Invitation à un document' : 'Accès modifié sur un document'
    const message = estNouveau
      ? `« ${check.document.titre} » vous a été partagé, avec un accès en ${niveau}.`
      : `Votre accès à « ${check.document.titre} » est maintenant en ${niveau}.`

    await admin.from('notifications').insert({ user_id: profileId, titre, message, lien: `/documents/${id}` })
      .then(({ error: e }) => { if (e) console.error('[Documents] Notif participant error:', e) })

    if (profile.email) {
      await sendEmail({
        to: profile.email,
        subject: `My ABED — ${titre} : ${check.document.titre}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#16a34a;">My ABED — ${titre}</h2>
            <p>Bonjour <strong>${profile.prenoms} ${profile.nom}</strong>,</p>
            <p>${message}</p>
            <a href="${APP_URL}/documents/${id}" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">Ouvrir le document</a>
            <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
          </div>
        `,
      }).catch(err => console.error('[Documents] Email participant error:', err))
    }
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
