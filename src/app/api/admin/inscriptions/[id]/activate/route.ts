import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { validate } from '@/lib/validate'

const ActivateSchema = z.object({
  role:       z.string().min(1, 'Rôle requis').max(50),
  type_emploi: z.string().min(1, 'Type d\'emploi requis').max(50),
  manager_id: z.string().uuid('ID responsable invalide').nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: actor } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !['admin', 'rh'].includes(actor.role)) {
    return NextResponse.json({ error: 'acces refuse' }, { status: 403 })
  }

  const rawBody = await req.json().catch(() => null)
  const v = validate(ActivateSchema, rawBody)
  if ('error' in v) return v.error
  const { role, type_emploi, manager_id } = v.data

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch profile before activation
  const { data: profile, error: fetchError } = await admin
    .from('profiles')
    .select('nom, prenoms, civilite, email, registration_status')
    .eq('id', id)
    .single()

  if (fetchError || !profile) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }
  if (profile.registration_status !== 'pending_activation') {
    return NextResponse.json({ error: 'Ce compte n\'est pas en attente d\'activation' }, { status: 400 })
  }

  // Activate: set role, type_emploi, manager_id, clear registration_status
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      role,
      type_emploi,
      manager_id:          manager_id || null,
      registration_status: null,
      must_change_password: true,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // In-app notification for the user
  await admin.from('notifications').insert({
    user_id: id,
    titre:   'Compte activé',
    message: 'Votre compte My ABED a été activé ! Vous pouvez maintenant vous connecter.',
    lien:    '/login',
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
  const civ = profile.civilite || 'M.'
  const fullName = `${profile.prenoms} ${profile.nom}`

  // Email to user: account is now active
  try {
    await sendEmail({
      to: profile.email,
      subject: '🎉 Votre compte My ABED est activé !',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#16a34a;font-size:22px;margin:0 0 4px">My ABED</h1>
            <p style="color:#6b7280;font-size:13px;margin:0">Plateforme de gestion ABED ONG</p>
          </div>
          <div style="background:white;border-radius:10px;padding:28px 24px;border:1px solid #e5e7eb">
            <p style="font-size:15px;color:#111827;margin:0 0 16px">Bonjour <strong>${civ} ${fullName}</strong>,</p>
            <p style="font-size:14px;color:#374151;margin:0 0 20px">
              Excellente nouvelle ! Votre compte sur la plateforme <strong>My ABED</strong> a été <strong style="color:#16a34a">activé</strong> par l'administrateur système.
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:20px;font-size:13px;color:#166534">
              Vous pouvez désormais vous connecter et accéder à toutes les fonctionnalités de la plateforme.
              Vous serez invité(e) à changer votre mot de passe lors de votre première connexion.
            </div>
            <a href="${appUrl}/login" style="display:block;text-align:center;background:#16a34a;color:white;padding:14px 0;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none">
              Se connecter →
            </a>
          </div>
          <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">My ABED — ABED ONG · Parakou, Bénin</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('[activate] email error:', e)
  }

  revalidateTag('profiles')
  return NextResponse.json({ ok: true })
}
