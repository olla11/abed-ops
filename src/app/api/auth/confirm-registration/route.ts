import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch profile to check status and get name
  const { data: profile } = await admin
    .from('profiles')
    .select('nom, prenoms, civilite, email, registration_status')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  // Only update if still pending_email (idempotent)
  if (profile.registration_status === 'pending_email') {
    await admin
      .from('profiles')
      .update({ registration_status: 'pending_activation' })
      .eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
  const civ = profile.civilite || 'M.'
  const fullName = `${profile.prenoms} ${profile.nom}`

  // Email to user: your email is confirmed, contact admin
  try {
    await sendEmail({
      to: profile.email,
      subject: 'Email confirmé — My ABED',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#16a34a;font-size:22px;margin:0 0 4px">My ABED</h1>
            <p style="color:#6b7280;font-size:13px;margin:0">Plateforme de gestion ABED ONG</p>
          </div>
          <div style="background:white;border-radius:10px;padding:28px 24px;border:1px solid #e5e7eb">
            <p style="font-size:15px;color:#111827;margin:0 0 16px">Bonjour <strong>${civ} ${fullName}</strong>,</p>
            <p style="font-size:14px;color:#374151;margin:0 0 16px">
              ✅ Votre adresse email a bien été confirmée.
            </p>
            <p style="font-size:14px;color:#374151;margin:0 0 20px">
              Votre compte est en attente d'activation par l'<strong>administrateur système</strong>.
              Une fois votre compte activé, votre rôle et votre responsable direct vous seront attribués,
              et vous recevrez une notification pour accéder à la plateforme.
            </p>
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:13px;color:#92400e">
              💡 Vous pouvez contacter l'administrateur système directement pour accélérer l'activation de votre compte.
            </div>
          </div>
          <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">My ABED — ABED ONG · Parakou, Bénin</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('[confirm-registration] user email error:', e)
  }

  // Notify all admins by email
  try {
    const { data: admins } = await admin
      .from('profiles')
      .select('email')
      .in('role', ['admin', 'rh'])
      .eq('archived', false)
      .is('registration_status', null)

    if (admins && admins.length > 0) {
      const adminEmails = admins.map((a: any) => a.email)
      await sendEmail({
        to: adminEmails,
        subject: `Nouvelle inscription en attente — ${fullName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
            <div style="background:white;border-radius:10px;padding:28px 24px;border:1px solid #e5e7eb">
              <p style="font-size:15px;color:#111827;margin:0 0 16px">Bonjour,</p>
              <p style="font-size:14px;color:#374151;margin:0 0 16px">
                Une nouvelle inscription est en attente d'activation sur la plateforme My ABED :
              </p>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:20px">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827">${civ} ${fullName}</p>
                <p style="margin:0;font-size:12px;color:#6b7280">${profile.email}</p>
              </div>
              <a href="${appUrl}/admin/inscriptions" style="display:block;text-align:center;background:#16a34a;color:white;padding:12px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
                Gérer les inscriptions →
              </a>
            </div>
            <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">My ABED — ABED ONG · Parakou, Bénin</p>
          </div>
        `,
      })
    }
  } catch (e) {
    console.error('[confirm-registration] admin notify error:', e)
  }

  return NextResponse.json({ ok: true })
}
