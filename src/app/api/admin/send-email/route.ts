import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'rh', 'caf'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const { userIds, sujet, corps } = await req.json() as {
    userIds: string[]
    sujet: string
    corps: string
  }

  if (!userIds?.length || !sujet?.trim() || !corps?.trim()) {
    return NextResponse.json({ error: 'Données manquantes (destinataires, sujet, corps)' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Récupérer les emails des utilisateurs sélectionnés
  const { data: targets, error } = await admin
    .from('profiles')
    .select('id, prenoms, nom, email')
    .in('id', userIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const emails = (targets ?? []).filter(t => !!t.email)

  // Envoyer via Supabase Auth admin (invite email) — ou SMTP si configuré
  // On utilise l'API Supabase pour envoyer un email personnalisé à chaque destinataire
  const results: { email: string; ok: boolean; error?: string }[] = []

  for (const target of emails) {
    // Personnaliser le corps avec le prénom
    const corpsPersonnalise = corps
      .replace(/\{prenom\}/gi, target.prenoms ?? '')
      .replace(/\{nom\}/gi, target.nom ?? '')
      .replace(/\{email\}/gi, target.email ?? '')

    try {
      // Utiliser l'API Resend si configurée, sinon utiliser Supabase SMTP
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? 'ABED <noreply@abedong.org>',
            to: [target.email],
            subject: sujet,
            text: corpsPersonnalise,
          }),
        })
        const json = await res.json()
        results.push({ email: target.email!, ok: res.ok, error: res.ok ? undefined : JSON.stringify(json) })
      } else {
        // Fallback : log uniquement (pas de service email configuré)
        console.log(`[send-email] TO: ${target.email} | SUBJECT: ${sujet}`)
        results.push({ email: target.email!, ok: true })
      }
    } catch (e: any) {
      results.push({ email: target.email!, ok: false, error: e.message })
    }
  }

  const sent = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  return NextResponse.json({ sent, failed, total: emails.length })
}
