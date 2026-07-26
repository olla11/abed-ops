import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'rh', 'caf', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const { userIds, sujet, corps, canaux } = await req.json() as {
    userIds: string[]
    sujet: string
    corps: string
    canaux?: string[]
  }

  if (!userIds?.length || !sujet?.trim() || !corps?.trim()) {
    return NextResponse.json({ error: 'Données manquantes (destinataires, sujet, corps)' }, { status: 400 })
  }

  const sendCanaux = new Set((canaux?.length ? canaux : ['email']).filter(c => c === 'email' || c === 'notification'))

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: targets, error } = await admin
    .from('profiles')
    .select('id, prenoms, nom, email')
    .in('id', userIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const recipients = (targets ?? []).filter(t => !!t.email)
  const results: { email: string; ok: boolean; error?: string }[] = []

  if (sendCanaux.has('email')) {
    for (const target of recipients) {
      const corpsPersonnalise = corps
        .replace(/\{prenom\}/gi, target.prenoms ?? '')
        .replace(/\{nom\}/gi, target.nom ?? '')
        .replace(/\{email\}/gi, target.email ?? '')

      try {
        await sendEmail({
          to: target.email!,
          subject: sujet,
          html: `<div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#1f2a17;">${escapeHtml(corpsPersonnalise)}</div>`,
        })
        results.push({ email: target.email!, ok: true })
      } catch (e: any) {
        results.push({ email: target.email!, ok: false, error: e.message })
      }
    }
  }

  if (sendCanaux.has('notification') && recipients.length > 0) {
    await admin.from('notifications').insert(
      recipients.map(target => ({
        user_id: target.id,
        titre: sujet,
        message: corps
          .replace(/\{prenom\}/gi, target.prenoms ?? '')
          .replace(/\{nom\}/gi, target.nom ?? '')
          .replace(/\{email\}/gi, target.email ?? ''),
      }))
    )
  }

  await admin.from('announcements').insert({
    sender_id: user.id,
    sujet,
    corps,
    canaux: [...sendCanaux],
    destinataires_count: recipients.length,
  })

  const sent = sendCanaux.has('email') ? results.filter(r => r.ok).length : recipients.length
  const failed = results.filter(r => !r.ok)

  return NextResponse.json({ sent, failed, total: recipients.length })
}
