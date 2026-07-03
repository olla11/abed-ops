import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { sendEmail } from '@/lib/resend'
import { z } from 'zod'

const RegisterSchema = z.object({
  email:          s.email,
  password:       s.password,
  nom:            s.nom,
  prenoms:        s.prenoms,
  civilite:       z.string().max(10).optional(),
  telephone:      z.string().min(1, 'Téléphone requis').max(30),
  fonction:       z.string().min(1, 'Fonction requise').max(255),
  adresse:        z.string().min(1, 'Adresse requise').max(255),
  date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  lieu_naissance: z.string().min(1, 'Lieu de naissance requis').max(100),
  nationalite:    z.string().min(1, 'Nationalité requise').max(100),
  ifu:            z.string().min(1, 'Numéro IFU requis').max(20),
  grade_indice:   z.string().max(50).optional(),
})

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, window: 60 })
  if (limited) return limited

  const rawBody = await req.json().catch(() => null)
  const v = validate(RegisterSchema, rawBody)
  if ('error' in v) return v.error

  const { email, password, nom, prenoms, civilite, telephone, fonction,
    adresse, date_naissance, lieu_naissance, nationalite, ifu, grade_indice } = v.data

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

  // If an unconfirmed account already exists with this email, delete it so the
  // user can re-register (e.g. after an expired confirmation link).
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    )
    if (res.ok) {
      const body = await res.json()
      const users: any[] = body.users ?? (Array.isArray(body) ? body : [])
      const ghost = users.find(u => u.email === email && !u.email_confirmed_at)
      if (ghost) {
        await admin.auth.admin.deleteUser(ghost.id)
      }
    }
  } catch (_) {}

  // Generate signup link — creates user + generates email confirmation link
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      data: { nom, prenoms },
      redirectTo: `${appUrl}/auth/callback?next=/auth/email-confirmed`,
    },
  })

  if (linkError || !linkData?.user) {
    const msg = linkError?.message ?? 'Erreur création du compte'
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const userId = linkData.user.id
  const actionLink = linkData.properties?.action_link

  // Update profile with all registration fields
  await admin.from('profiles').update({
    nom, prenoms,
    civilite:        civilite       || 'M.',
    telephone:       telephone      || null,
    fonction:        fonction       || null,
    adresse:         adresse        || null,
    date_naissance:  date_naissance || null,
    lieu_naissance:  lieu_naissance || null,
    nationalite:     nationalite    || null,
    ifu:             ifu            || null,
    grade_indice:    grade_indice   || null,
    registration_status: 'pending_email',
    must_change_password: false,
  }).eq('id', userId)

  // Send custom confirmation email
  if (actionLink) {
    // Wrap the Supabase action link via /auth/go?to=BASE64 so email scanners
    // (Gmail Safe Browsing, Outlook Safe Links) cannot pre-fetch and consume the OTP.
    // Those scanners don't execute JavaScript, so window.location.href in /auth/go
    // is only triggered by a real browser click.
    const safeLink = `${appUrl}/auth/go?to=${Buffer.from(actionLink).toString('base64')}`
    try {
      await sendEmail({
        to: email,
        subject: 'Confirmez votre adresse email — My ABED',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
            <div style="text-align:center;margin-bottom:24px">
              <h1 style="color:#16a34a;font-size:22px;margin:0 0 4px">My ABED</h1>
              <p style="color:#6b7280;font-size:13px;margin:0">Plateforme de gestion ABED ONG</p>
            </div>
            <div style="background:white;border-radius:10px;padding:28px 24px;border:1px solid #e5e7eb">
              <p style="font-size:15px;color:#111827;margin:0 0 16px">Bonjour <strong>${civilite || 'M.'} ${prenoms} ${nom}</strong>,</p>
              <p style="font-size:14px;color:#374151;margin:0 0 24px">
                Merci de vous être inscrit(e) sur <strong>My ABED</strong>. Veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
              </p>
              <a href="${safeLink}" style="display:block;text-align:center;background:#16a34a;color:white;padding:14px 0;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:20px">
                ✅ Valider mon email
              </a>
              <p style="font-size:12px;color:#9ca3af;margin:0;text-align:center">
                Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.
              </p>
            </div>
            <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">
              My ABED — ABED ONG · Parakou, Bénin
            </p>
          </div>
        `,
      })
    } catch (e) {
      console.error('[register] email error:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
